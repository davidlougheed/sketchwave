module.exports.errors = {
    403: 'forbidden',
    404: 'notFound'
};

module.exports.generate = function (req, res, error, meta) {
    res.status(error);

    if(req.accepts('html')) {
        return res.render('errors/' + error.toString(), { meta: meta });
    }
    if(req.accepts('json')) {
        return res.send({ success: false, error: module.exports.errors[error] });
    }

    return res.type('txt').send(module.exports.errors[error]);
};
