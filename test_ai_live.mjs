const res = await fetch('https://bridgejobs.ug/api/ai/generate-summary', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cv: {
      firstName: 'Sarah', lastName: 'Kalungi', title: 'Software Developer',
      skills: ['JavaScript', 'React', 'Python'],
      experience: [{ position: 'Junior Developer', company: 'Tech Hub Kampala' }],
      education: [{ degree: 'BSc', field: 'Computer Science', school: 'Makerere University' }],
    },
  }),
});
const text = await res.text();
console.log({ status: res.status, body: text });
