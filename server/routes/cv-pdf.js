import { Router } from 'express';
import { AppError } from '../lib/errors.js';
import { generateCvPdf } from '../lib/cv-pdf.js';

const router = Router();

router.post('/cv/pdf', async (req, res, next) => {
  try {
    const cv = req.body;
    if (!cv || (!cv.firstName && !cv.lastName)) {
      throw new AppError(400, 'CV data is required');
    }

    const pdf = await generateCvPdf(cv);
    const filename = `${cv.firstName || 'CV'}_${cv.lastName || 'Bridge'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

export default router;
