var _r1, _r2, a;

var count = 2;

function update() {
    if (--count === 0) {
        foo(_r1 + _r2, function(_err, _r3) {
            if (_err) return cb(_err);
            a = _r3;
        });
    }
}

foo(function(_err, __r1) {
    if (_err) return cb(_err);
    _r1 = __r1;
    update();
});

foo(function(_err, __r2) {
    if (_err) return cb(_err);
    _r2 = __r2;
    update();
});