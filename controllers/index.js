'use strict';

var bcrypt = require('bcrypt');
var request = require('request');

module.exports.controller = function (objects) {
	objects.router.get('/', function (req, res) {
		if (req.isAuthenticated()) {
			return res.redirect('/conversations/');
		}

		res.render('index');
	});
	objects.router.get('/about/', function (req, res) {
		res.render('about');
	});
	objects.router.get('/contact/', function (req, res) {
		res.render('contact');
	});

	objects.router.get('/signup/', function (req, res) {
		if (req.isAuthenticated()) {
			return res.redirect('/conversations/');
		}

		res.render('signup');
	});
	objects.router.post('/signup/', function (req, res) {
		if (req.isAuthenticated()) {
			return res.redirect('/conversations/');
		}

		if (!req.body) { return res.send({ success: false, error: 'noBody' }); }

		if (!req.body.username) { return res.send({ success: false, error: 'noUsername' }); }
		if (!req.body.password) { return res.send({ success: false, error: 'noPassword' }); }
        if (!req.body.password2) { return res.send({ success: false, error: 'noPassword2' }); }

		if (req.body.password !== req.body.password2) {
            return res.send({ success: false, error: 'passwordMismatch' });
		}

		if (req.body.username.length < 3) { return res.send({ success: false, error: 'usernameTooShort' }); }
        if (req.body.password.length < 8) { return res.send({ success: false, error: 'passwordTooShort' }); }

		// Check CAPTCHA
		request.post('https://www.google.com/recaptcha/api/siteverify', {
			form: {
				secret: objects.config.captchaSecret,
				response: req.body['g-recaptcha-response'],
				remoteip: req.headers['x-forwarded-for'] // IP Address of client
			}
		}, function (err, response, body) {
			if (err) {
				throw err;
			}

			if (JSON.parse(body)['success'] === true) {
				// TODO: Currently synchronous
				var salt = bcrypt.genSaltSync(10);
				var hashedPassword = bcrypt.hashSync(req.body.password, salt);

				// TODO: Fix XSS vulnerability with direct avatar database pass
				objects.models.User.create({
					username: req.body.username,
					password: hashedPassword,
					avatar: req.body.avatar
				}).then(function (user) {
					req.login(user, function (err) {
						if (err) {
							return next(err);
						}
						return res.redirect('/conversations/');
					});
				});
			} else {
				// TODO: Handle reCAPTCHA failure
				return res.send({ error: 'captcha_failure' });
			}
		});
	});

	objects.router.get('/login/', function (req, res) {
		if (req.isAuthenticated()) {
			return res.redirect('/conversations/');
		}

		if(req.query.redirect) {
			return res.render('login', { error: req.flash('error'), redirect: req.query.redirect });
		}

		return res.render('login', { error: req.flash('error'), redirect: '/' });
	});
	objects.router.post('/login/', objects.passport.authenticate('local', {
		failureRedirect: '/login/',
        failureFlash: true
	}), function (req, res) {
		if (req.body.redirect) {
			res.redirect(req.body.redirect);
		} else {
			res.redirect('/conversations/');
		}
	});

	objects.router.get('/logout/', function (req, res) {
		req.logout();
		res.redirect('/');
	});

	objects.router.get('/keepalive/', function (req, res) {
		req.session.lastAccess = new Date().getTime();
		res.sendStatus(200);
	});
};
