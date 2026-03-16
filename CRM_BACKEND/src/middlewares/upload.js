import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name:'du8cblqgj',
  api_key:'997843259464259',
  api_secret:'zcY4W7urXdjT_Cg2C23aSjO6X5I',
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const timestamp = Date.now();
    const userId = req.user?.user_id || 'anonymous';
    const extension = file.originalname.split('.').pop();
    const filename = `${userId}_${file.fieldname}_${timestamp}.${extension}`;

    return {
      folder: 'employee_profiles',
      public_id: filename,
      allowed_formats: ['jpg', 'jpeg', 'png'],
    };
  },
});

export const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
