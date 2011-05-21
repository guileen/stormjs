var a, _i, _2, _done = 0;

function trigger(_flag) {
    if (7 === ((_done |= _flag) & 7)) {
        for (var i = _i, bar; i < _2; i++) {
            foo(a, function(_err, _3) {
                if (_err) return cb(_err);
            });
        }
    }
}

for (var i = 0; i < 100; i++) {
    foo(i, function(_err, _1) {
        if (_err) return cb(_err);
    });
}

foo(function(_err, _a) {
    if (_err) return cb(_err);
    a = _a;
    for (var i = 0, bar; i < 100; i++, bar = 0) {
        foo(a, function(_err, _4) {
            if (_err) return cb(_err);
        });
    }
    trigger(4);
});

foo(function(_err, __i) {
    if (_err) return cb(_err);
    _i = __i;
    trigger(1);
});

foo(function(_err, __2) {
    if (_err) return cb(_err);
    _2 = __2;
    trigger(2);
});