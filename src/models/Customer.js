import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    npwp: { type: String, required: true, match: /^\d{15,16}$/ },
    npwpName: { type: String, required: true, trim: true },
    taxAddress: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

customerSchema.index({ name: 1 });
customerSchema.index({ npwp: 1 });

export const Customer = mongoose.models.Customer ?? mongoose.model('Customer', customerSchema);
export default Customer;
