'use strict';

module.exports.ERROR_BAD_REQUEST = 400;
module.exports.ERROR_FORBIDDEN = 403;
module.exports.ERROR_NOT_FOUND = 404;
module.exports.ERROR_INTERNAL_SERVER = 500;

module.exports.MESSAGE_INVALID_ID = 'invalidId';
module.exports.MESSAGE_PARAMETERS_REQUIRED = 'additionalParametersRequired';
module.exports.MESSAGE_NOT_AUTHENTICATED = 'notAuthenticated';

var errors = {};

errors[module.exports.ERROR_BAD_REQUEST] = 'badRequest';
errors[module.exports.ERROR_FORBIDDEN] = 'forbidden';
errors[module.exports.ERROR_NOT_FOUND] = 'notFound';

errors[module.exports.ERROR_INTERNAL_SERVER] = 'internalServerError';

module.exports.errors = errors;

module.exports.generate = function (req, res, error, meta, message) {
    message = message || '';
    res.status(error);

    if (req.accepts('html')) {
        return res.render('errors/' + error.toString(), { meta: meta, errorMessage: message });
    }
    if (req.accepts('json')) {
        return res.send({ success: false, error: module.exports.errors[error], message: message });
    }

    return res.type('txt').send(module.exports.errors[error]);
};
