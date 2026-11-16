import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

vendorSchema.index({ name: 1 });

export const Vendor = mongoose.models.Vendor ?? mongoose.model('Vendor', vendorSchema);
export default Vendor;
