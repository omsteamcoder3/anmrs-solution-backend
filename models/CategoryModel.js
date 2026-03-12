import mongoose from "mongoose";
import slugify from "slugify";

const fieldSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["text", "number", "select"],
      default: "text",
    },

    unit: {
      type: String,
      default: "",
      trim: true,
    },

    options: {
      type: [String],
      default: [],
    },
  },
  { _id: false } // prevent Mongo from creating _id for each field
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    fields: {
      type: [fieldSchema],
      default: [],
    },
  },
  { timestamps: true }
);


// Auto-generate slug from name
categorySchema.pre("validate", function (next) {
  if (this.name) {
    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
  next();
});

const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;