import mongoose from "mongoose";

const employeeProfileSchema = mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    
    // Personal Information
    employeeFullName: { type: String, required: true },
    employeeId: { type: String, unique: true }, // Auto-generated
    designation: { type: String, required: true },
    department: { 
      type: String, 
      required: true,
      enum: ["Sales", "Digital", "Admin", "Legal", "Finance"]
    },
    branch: { 
      type: String, 
      required: true,
      enum: ["Main Branch"]
    },
    gender: { 
      type: String, 
      required: true,
      enum: ["Male", "Female", "Other"]
    },
    maritalStatus: { 
      type: String, 
      required: true,
      enum: ["Single", "Married", "Divorced", "Widowed"]
    },
    dateOfBirth: { type: Date, required: true },
    
    // Contact Information
    personalContactNumber: { type: String, required: true },
    personalEmailAddress: { 
      type: String, 
      required: true,
      lowercase: true,
      trim: true
    },
    workEmail: { 
      type: String, 
      required: true,
      lowercase: true,
      trim: true
    },
    workPhoneNumber: { type: String, required: true },
    
    // Address Information
    permanentAddress: { type: String, required: true },
    currentAddress: { type: String, required: true },
    
    // Emergency Contact
    emergencyContactName: { type: String, required: true },
    emergencyContactNumber: { type: String, required: true },
    emergencyContactRelationship: { 
      type: String, 
      required: true,
      enum: ["Father", "Mother", "Spouse", "Brother", "Sister", "Friend", "Other"]
    },
    
    // Professional Information
    dateOfJoining: { type: Date, default: Date.now },
    reportingManager: { type: String, required: true },
    offeredSalary: { type: String, required: true },
    dateOfLastPromotion: { type: Date },
    compensationDetails: {
      fixedMonthly: { type: Number, default: 0 },
      fixedAnnual: { type: Number, default: 0 },
      variablePay: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      remarks: { type: String, default: "" },
    },
    
    // Education & Experience
    educationQualification: { type: String, required: true },
    previousEmployer: { type: String },
    totalWorkExperience: { type: String, required: true },
    
    // Bank Details
    accountNumber: { type: String, required: true },
    bankName: { type: String, required: true },
    ifscCode: { type: String, required: true },
    panNumber: { 
      type: String, 
      required: true,
      uppercase: true,
      trim: true
    },
    aadharNumber: { type: String, required: true },
    
    // Document Files
    employeePhoto: { type: String, required: true },
    aadhaarCardPhoto: { type: String, required: true },
    supportingDocuments: [
      {
        title: { type: String, required: true },
        category: {
          type: String,
          enum: ["experience_letter", "offer_letter", "salary_document", "id_document", "other"],
          default: "other",
        },
        fileUrl: { type: String, required: true },
        uploadedBy: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    
    // System fields
    isActive: { type: Boolean, default: true },
    profileCompletionStatus: { 
      type: String, 
      enum: ["incomplete", "pending_review", "approved", "rejected"],
      default: "pending_review"
    },
    
    // Audit trail
    createdBy: { type: String },
    updatedBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    
    // Update history
    updateHistory: [
      {
        updatedBy: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now },
        changes: {
          type: Map,
          of: {
            oldValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed
          }
        },
        reason: { type: String }
      }
    ]
  },
  { 
    timestamps: true,
    versionKey: false 
  }
);

// Pre-save middleware to generate employee ID
employeeProfileSchema.pre('save', async function(next) {
  if (this.isNew && !this.employeeId) {
    try {
      // Generate employee ID based on department and sequence
      const deptCode = {
        'Sales': 'SL',
        'Digital': 'DG',
        'Admin': 'AD',
        'Legal': 'LG',
        'Finance': 'FN'
      };
      
      const prefix = deptCode[this.department] || 'EMP';
      const year = new Date().getFullYear().toString().slice(-2);
      
      // Find the last employee ID with this prefix
      const lastEmployee = await this.constructor
        .findOne({ employeeId: new RegExp(`^${prefix}${year}`) })
        .sort({ employeeId: -1 });
      
      let sequence = 1;
      if (lastEmployee && lastEmployee.employeeId) {
        const lastSequence = parseInt(lastEmployee.employeeId.slice(-4));
        sequence = lastSequence + 1;
      }
      
      this.employeeId = `${prefix}${year}${sequence.toString().padStart(4, '0')}`;
      this.createdBy = this.userId;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Index for better query performance
employeeProfileSchema.index({ userId: 1 });
employeeProfileSchema.index({ employeeId: 1 });
employeeProfileSchema.index({ department: 1 });
employeeProfileSchema.index({ branch: 1 });
employeeProfileSchema.index({ personalEmailAddress: 1 });
employeeProfileSchema.index({ workEmail: 1 });

export const EmployeeModel = mongoose.model("EmployeeProfile", employeeProfileSchema);