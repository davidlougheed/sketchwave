var bcrypt = require('bcrypt');

module.exports.controller = function (objects) {
    objects.router.get('/', function (req, res) {
        if(req.isAuthenticated()) {
			return res.redirect('/conversations/');
		}

        res.render('index');
    });

    objects.router.get('/signup/', function (req, res) {
        if(req.isAuthenticated()) {
            return res.redirect('/conversations/');
        }

        res.render('signup');
    });
    objects.router.post('/signup/', function (req, res) {
        if(req.isAuthenticated()) {
            return res.redirect('/conversations/');
        }

        //TODO: Handle errors properly
        if (!req.body) {
            return res.send('error no body');
        }
        if (req.body.password !== req.body.password2) {
            return res.send('error passwords don\'t match');
        }

        var salt = bcrypt.genSaltSync(10);
        var hashedPassword = bcrypt.hashSync(req.body.password, salt);

        objects.models.User.create({
            username: req.body.username,
            password: hashedPassword
        }).then(function () {
            res.redirect('/login/');
        });
    });

    objects.router.get('/login/', function (req, res) {
        if(req.isAuthenticated()) {
            return res.redirect('/conversations/');
        }

        res.render('login');
    });
    objects.router.post('/login/', objects.passport.authenticate('local', {
        successRedirect: '/conversations/',
        failureRedirect: '/login/'
    }));

    objects.router.get('/logout/', function (req, res) {
        req.logout();
        res.redirect('/');
    });
};
