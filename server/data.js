import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from './lib/db.js';

export async function seed() {
  const existing = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(existing.rows[0].count) > 0) return;

  const hash = await bcrypt.hash('admin123', 10);
  const adminId = uuidv4();
  await pool.query(
    'INSERT INTO users (id, email, password, full_name, role, created_date) VALUES ($1,$2,$3,$4,$5,now())',
    [adminId, 'kamulegeyajoshua534@gmail.com', hash, 'Admin', 'admin']
  );

  const categoryImages = {
    Internship: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&h=400&fit=crop',
    Scholarship: 'https://images.unsplash.com/photo-1523050854058-8df90110c7f1?w=600&h=400&fit=crop',
    Training: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&h=400&fit=crop',
    Volunteer: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=600&h=400&fit=crop',
    Job: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop',
    Fellowship: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=600&h=400&fit=crop',
    Grant: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop',
  };

  const opportunities = [
    { title: 'UNICEF Youth Internship Program 2026', description: 'A 6-month paid internship for Ugandan youth aged 20-30 to work on child rights and social policy programs.', link: 'https://www.unicef.org/careers/internship-program', category: 'Internship', deadline: '2026-08-30', image_url: categoryImages.Internship, featured_order: 1 },
    { title: 'Mastercard Foundation Scholars Program', description: 'Full scholarship for undergraduate studies at partner universities in Africa. Covers tuition, accommodation, books, and living stipend.', link: 'https://mastercardfdn.org/all/scholars/', category: 'Scholarship', deadline: '2026-10-15', image_url: categoryImages.Scholarship, featured_order: 2 },
    { title: 'Andela Uganda - Software Engineering Training', description: 'A fully remote software engineering program. Learn in-demand skills and connect with global tech companies.', link: 'https://www.andela.com/apply', category: 'Training', deadline: '2026-09-01', image_url: categoryImages.Training, featured_order: 3 },
    { title: 'UN Volunteer Program - Uganda', description: 'Volunteer with UN agencies across Uganda. Positions in health, education, environment, and community development.', link: 'https://www.unv.org/volunteer-opportunities', category: 'Volunteer', deadline: '2026-12-31', image_url: categoryImages.Volunteer, featured_order: 4 },
    { title: 'Uganda Revenue Authority Graduate Trainee Program', description: 'A 12-month graduate trainee program for recent graduates. Gain experience in taxation, customs, and administration.', link: 'https://www.ura.go.ug/careers', category: 'Job', deadline: '2026-07-30', image_url: categoryImages.Job, featured_order: 5 },
    { title: 'KCB Bank Uganda - Entry Level Positions', description: 'Multiple entry-level banking positions for fresh graduates. Training provided.', link: 'https://www.kcbgroup.com/careers', category: 'Job', deadline: '2026-08-15', image_url: categoryImages.Job, featured_order: 6 },
    { title: 'African Leadership Academy Fellowship', description: 'A transformative one-year fellowship for young African leaders aged 18-28. Includes leadership training, mentorship, and networking.', link: 'https://www.africanleadershipacademy.org/fellowship', category: 'Fellowship', deadline: '2026-09-30', image_url: categoryImages.Fellowship, featured_order: 7 },
    { title: 'Obama Foundation Leaders Africa Program', description: 'A regional leadership development program that supports emerging leaders from across Africa working on civic engagement and inclusive growth.', link: 'https://www.obama.org/leaders-africa', category: 'Fellowship', deadline: '2026-10-01', image_url: categoryImages.Fellowship },
    { title: 'African Union Youth Volunteer Corps', description: 'A continental volunteer program that places young Africans aged 18-34 in various African Union institutions and member states.', link: 'https://auyvc.au.int', category: 'Fellowship', deadline: '2026-11-15', image_url: categoryImages.Fellowship },
    { title: 'Tayari Small Business Grants for Ugandan Youth', description: 'Grants of up to UGX 5 million for young Ugandan entrepreneurs aged 18-35. Must have a registered business operating for at least 6 months.', link: 'https://tayari.ug/grants', category: 'Grant', deadline: '2026-08-20', image_url: categoryImages.Grant },
    { title: 'Tony Elumelu Foundation Entrepreneurship Grant', description: 'A $5,000 seed capital grant for African entrepreneurs aged 18-45 with innovative business ideas across all sectors.', link: 'https://www.tonyelumelufoundation.org/entrepreneurship', category: 'Grant', deadline: '2026-12-01', image_url: categoryImages.Grant },
    { title: 'UN Women Youth Grant for Gender Equality', description: 'Grant funding for youth-led organizations in Uganda working on gender equality and women empowerment projects.', link: 'https://www.unwomen.org/grant', category: 'Grant', deadline: '2026-09-15', image_url: categoryImages.Grant },
  ];

  for (const opp of opportunities) {
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, category, deadline, status, featured_order, created_by, created_date, updated_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,now(),now())`,
      [uuidv4(), opp.title, opp.description, opp.link, opp.image_url, opp.category, opp.deadline, opp.featured_order || null, adminId]
    );
  }

  console.log('Database seeded successfully');
}
