// GET /kaprodi/dashboard
const dashboard = (req, res) => {
  res.render('kaprodi/dashboard', {
    title: 'Dashboard Ketua Program Studi',
    pageTitle: 'Dashboard Ketua Program Studi',
    pageSubtitle: 'Pengajuan terverifikasi yang menunggu keputusan Anda',
  });
};

module.exports = { dashboard };
