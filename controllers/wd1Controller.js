// GET /dekan/dashboard
const dashboard = (req, res) => {
  res.render('wd1/dashboard', {
    title: 'Dashboard Wakil Dekan 1',
    pageTitle: 'Dashboard Wakil Dekan 1',
    pageSubtitle: 'Keputusan akhir atas pengajuan yang disetujui prodi',
  });
};

module.exports = { dashboard };
