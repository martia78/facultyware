// GET /mahasiswa/dashboard
const dashboard = (req, res) => {
  res.render('mahasiswa/dashboard', {
    title: 'Dashboard Mahasiswa',
    pageTitle: 'Dashboard',
    pageSubtitle: 'Ringkasan status pengajuan Anda',
  });
};

module.exports = { dashboard };
