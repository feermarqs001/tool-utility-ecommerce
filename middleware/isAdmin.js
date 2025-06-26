module.exports = (req, res, next) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/auth/login');
    }
    if (req.session.userRole !== 'admin') {
        req.flash('error_msg', 'Você não tem permissão para acessar esta área.');
        return res.redirect('/'); 
    }
    next();
};