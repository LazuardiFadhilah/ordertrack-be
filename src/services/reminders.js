const AGE_MS = 2 * 24 * 60 * 60 * 1000;

const olderThan = (date, now) => new Date(date).getTime() <= now - AGE_MS;

export function createReminderService({ goodsReceiptModel, shippingRequestModel, deliveryOrderModel, invoiceModel, notificationModel, notificationService, userModel }) {
  const notify = notificationService?.notify ?? (() => Promise.resolve());
  const createReminder = async ({ recipient, soId, type, title, message, entityType, entityId }) => {
    const recipientIds = recipient === 'SALES' || recipient === 'AR'
      ? (await userModel?.find?.({ role: recipient }).lean() ?? []).map((user) => String(user._id))
      : [];
    await notify({ userIds: recipientIds, soId, type, title, message, entityType, entityId });
  };
  return {
    async run(now = new Date()) {
      const cutoff = new Date(now.getTime() - AGE_MS);
      const [receipts, signedOrders] = await Promise.all([
        goodsReceiptModel.find({}).lean(),
        deliveryOrderModel.find({ status: 'SIGNED_RETURNED' }).lean(),
      ]);
      let created = 0;
      for (const receipt of receipts.filter((item) => olderThan(item.receivedAt, now))) {
        const request = await shippingRequestModel.findOne({ soId: receipt.soId }).lean();
        if (request) continue;
        const type = 'REMINDER_SHIPPING_REQUEST';
        const exists = await notificationModel.findOne({ type, entityType: 'GoodsReceipt', entityId: String(receipt._id) }).lean();
        if (exists) continue;
        await createReminder({ recipient: 'SALES', soId: receipt.soId, type, title: 'Shipping request diperlukan', message: `Barang ${receipt.grNumber} telah diterima lebih dari 2 hari tanpa shipping request`, entityType: 'GoodsReceipt', entityId: receipt._id });
        created += 1;
      }
      for (const order of signedOrders.filter((item) => olderThan(item.updatedAt, now))) {
        const invoice = await invoiceModel.findOne({ soId: order.soId, status: { $ne: 'VOID' } }).lean();
        if (invoice) continue;
        const type = 'REMINDER_INVOICE';
        const exists = await notificationModel.findOne({ type, entityType: 'DeliveryOrder', entityId: String(order._id) }).lean();
        if (exists) continue;
        await createReminder({ recipient: 'AR', soId: order.soId, type, title: 'Invoice diperlukan', message: `DO ${order.doNumber} telah ditandatangani lebih dari 2 hari dan belum ditagih`, entityType: 'DeliveryOrder', entityId: order._id });
        created += 1;
      }
      return { created, scanned: receipts.length + signedOrders.length };
    },
  };
}

export { olderThan };
