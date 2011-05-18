var _r1, a, _r2, b, c;

var count = 2;

function update() {
    if (--count === 0) {
        foo(a, b, function(_err, _r3) {
            if (_err) return cb(_err);
            c = _r3;
        });
    }
}

foo(function(_err, __r1) {
    if (_err) return cb(_err);
    _r1 = __r1;
    a = _r1;
    update();
});

foo(function(_err, __r2) {
    if (_err) return cb(_err);
    _r2 = __r2;
    b = _r2;
    update();
});
