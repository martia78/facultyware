// GET /admin/dashboard
const dashboard = (req, res) => {
  res.render('admin/dashboard', {
    title: 'Dashboard Admin Akademik',
    pageTitle: 'Dashboard Admin Akademik',
    pageSubtitle: 'Ringkasan pengajuan yang perlu diverifikasi',
  });
};

module.exports = { dashboard };
