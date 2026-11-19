import { connectToDatabase } from '../src/db/mongoose.js';
import Customer from '../src/models/Customer.js';
import Vendor from '../src/models/Vendor.js';
import Quotation from '../src/models/Quotation.js';
import SalesOrder from '../src/models/SalesOrder.js';

if (process.env.SEED_DEMO !== 'true') throw new Error('Set SEED_DEMO=true to seed demo records');
await connectToDatabase();

const customers = [
  { name: 'PT Dummy Nusantara', address: 'Jl. Contoh No. 1, Jakarta', contact: 'Dummy Contact 01', npwp: '0123456789012345', npwpName: 'PT Dummy Nusantara', taxAddress: 'Jl. Contoh No. 1, Jakarta' },
  { name: 'CV Contoh Persada', address: 'Jl. Sampel No. 2, Bandung', contact: 'Dummy Contact 02', npwp: '9876543210987654', npwpName: 'CV Contoh Persada', taxAddress: 'Jl. Sampel No. 2, Bandung' },
];
const vendors = [
  { name: 'PT Vendor Contoh', contact: 'Dummy Vendor Contact 01' },
  { name: 'CV Pasok Sampel', contact: 'Dummy Vendor Contact 02' },
];
const ids = new Map();
for (const data of customers) {
  const record = await Customer.findOneAndUpdate({ name: data.name }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true });
  ids.set(data.name, record.id);
}
for (const data of vendors) await Vendor.findOneAndUpdate({ name: data.name }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true });

const examples = [
  { number: 'QTN-DEMO-0001', customerName: customers[0].name, status: 'SENT', sku: 'DUM-001', name: 'Komponen Contoh A', qty: 10, unitPrice: 150000 },
  { number: 'QTN-DEMO-0002', customerName: customers[1].name, status: 'DRAFT', sku: 'DUM-002', name: 'Komponen Sampel B', qty: 6, unitPrice: 225000 },
];
for (const item of examples) {
  const lineTotal = item.qty * item.unitPrice;
  const quotation = await Quotation.findOneAndUpdate({ number: item.number }, { $set: {
    number: item.number, customerId: ids.get(item.customerName), customerName: item.customerName,
    items: [{ sku: item.sku, name: item.name, qty: item.qty, unitPrice: item.unitPrice, lineTotal }],
    totalAmount: lineTotal, status: item.status,
    createdBy: { id: 'demo-sales', name: 'Dummy SALES User' }, salesOrderId: null,
  } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  if (item.status === 'SENT') await SalesOrder.findOneAndUpdate({ soNumber: 'SO-DEMO-0001' }, { $set: {
    soNumber: 'SO-DEMO-0001', customerPoNumber: 'PO-DUMMY-001', customerId: ids.get(item.customerName), customerName: item.customerName,
    quotationId: quotation.id, quotationNumber: quotation.number, salesId: 'demo-sales', salesName: 'Dummy SALES User',
    items: [{ sku: item.sku, name: item.name, qtyOrdered: item.qty, qtyReceived: 4, qtyShipped: 0, qtyInvoiced: 0, unitPrice: item.unitPrice }],
    totalAmount: lineTotal, status: 'PARTIAL_RECEIVED',
  } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
process.stdout.write('Upserted 2 dummy customers, 2 dummy vendors, 2 dummy quotations, and 1 dummy sales order.\n');
await Promise.all([Customer.db.close(), Vendor.db.close(), Quotation.db.close(), SalesOrder.db.close()]);
