module.exports.controller = function (objects) {
    objects.router.get('/', function (req, res) {
        res.render('index');
    });

    objects.router.get('/signup', function (req, res) {
        res.render('signup');
    });
    objects.router.post('/signup', function (req, res) {

    });

    objects.router.get('/login', function (req, res) {
        res.render('login');
    });
    objects.router.post('/login', function (req, res) {

    });
};
