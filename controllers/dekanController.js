// GET /dekan/dashboard
const dashboard = (req, res) => {
  res.render('dekan/dashboard', {
    title: 'Dashboard Dekan',
    pageTitle: 'Dashboard Dekan',
    pageSubtitle: 'Keputusan akhir atas pengajuan yang disetujui prodi',
  });
};

module.exports = { dashboard };
