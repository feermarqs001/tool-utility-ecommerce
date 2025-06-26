module.exports = (req, res, next) => {
    if (req.session.isAuthenticated) {
        return next();
    }
    req.flash('error_msg', 'Por favor, faça login para acessar esta página.');
    res.redirect('/auth/login');
};