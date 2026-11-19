import { connectToDatabase } from '../src/db/mongoose.js';
import Customer from '../src/models/Customer.js';
import Vendor from '../src/models/Vendor.js';
import Quotation from '../src/models/Quotation.js';
import SalesOrder from '../src/models/SalesOrder.js';
import User from '../src/models/User.js';

if (process.env.SEED_DEMO !== 'true') throw new Error('Set SEED_DEMO=true to seed demo records');
if (process.env.DEMO_SEED_TARGET !== 'production') throw new Error('Set DEMO_SEED_TARGET=production to confirm the target database');
await connectToDatabase();
const demoSales = await User.findOne({ email: 'sales@example.test' }).select('_id name').lean();
if (!demoSales) throw new Error('Seed users first: sales@example.test is missing');

const pad = (n) => String(n).padStart(3, '0');
const customers = [];
for (let i = 1; i <= 20; i += 1) {
  const name = `Dummy Customer ${pad(i)}`;
  const address = `Jl. Contoh Dummy No. ${i}, Jakarta`;
  const data = { name, address, contact: `Kontak Dummy ${pad(i)}`, npwp: String(1000000000000000 + i), npwpName: name, taxAddress: address };
  customers.push(await Customer.findOneAndUpdate({ name }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true }));
}
for (let i = 1; i <= 10; i += 1) {
  const name = `Dummy Vendor ${pad(i)}`;
  await Vendor.findOneAndUpdate({ name }, { $set: { name, contact: `Kontak Vendor Dummy ${pad(i)}` } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
for (let i = 1; i <= 40; i += 1) {
  const customer = customers[(i - 1) % customers.length];
  const number = `QTN-DEMO-${pad(i)}`;
  const qty = 2 + (i % 9);
  const unitPrice = 50000 + (i % 17) * 12500;
  const lineTotal = qty * unitPrice;
  const quotation = await Quotation.findOneAndUpdate({ number }, { $set: {
    number, customerId: customer.id, customerName: customer.name,
    items: [{ sku: `DUM-${pad(i)}`, name: `Produk Dummy ${pad(i)}`, qty, unitPrice, lineTotal }],
    totalAmount: lineTotal, status: i % 5 === 0 ? 'DRAFT' : 'SENT',
    createdBy: { id: String(demoSales._id), name: demoSales.name }, salesOrderId: null,
  } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (i <= 30) {
    const received = i % 3 === 0 ? qty : Math.floor(qty / 2);
    await SalesOrder.findOneAndUpdate({ soNumber: `SO-DEMO-${pad(i)}` }, { $set: {
      soNumber: `SO-DEMO-${pad(i)}`, customerPoNumber: `PO-DUMMY-${pad(i)}`,
      customerId: customer.id, customerName: customer.name,
      quotationId: quotation.id, quotationNumber: number, salesId: String(demoSales._id), salesName: demoSales.name,
      items: [{ sku: `DUM-${pad(i)}`, name: `Produk Dummy ${pad(i)}`, qtyOrdered: qty, qtyReceived: received, qtyShipped: i % 4 === 0 ? received : 0, qtyInvoiced: 0, unitPrice }],
      totalAmount: lineTotal, status: ['PO_RECEIVED', 'PROCURING', 'PARTIAL_RECEIVED', 'GOODS_RECEIVED', 'SHIPPING_REQUESTED', 'SHIPPED'][i % 6],
    } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
}
process.stdout.write('Upserted 20 customers, 10 vendors, 40 quotations, and 30 sales orders (100 records total).\n');
await Promise.all([Customer.db.close(), Vendor.db.close(), Quotation.db.close(), SalesOrder.db.close()]);
