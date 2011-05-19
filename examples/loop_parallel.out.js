var a;

var count = 3;

function update() {
    if (--count === 0) {
        for (var i = _r3, bar; i < _r4; i++) {
            foo(a, function(_err, _r5) {
                if (_err) return cb(_err);
            });
        }
    }
}

for (var i = 0; i < 100; i++) {
    foo(i, function(_err, _r1) {
        if (_err) return cb(_err);
    });
}

foo(function(_err, _r2) {
    if (_err) return cb(_err);
    a = _r2;
    for (var i = 0, bar; i < 100; i++, bar = 0) {
        foo(a, function(_err, _r6) {
            if (_err) return cb(_err);
        });
    }
    update();
});

foo(function(_err, __r3) {
    if (_err) return cb(_err);
    _r3 = __r3;
    update();
});

foo(function(_err, __r4) {
    if (_err) return cb(_err);
    _r4 = __r4;
    update();
});