var sum, a, b, c, d, _1, _2, _a, _b, _c, _done = 0;

var triggers = [ function(_index) {
    if (3 === (_done & 3)) {
        triggers.splice(_index, 1);
        foo(_1 + _2, function(_err, _sum) {
            if (_err) return cb(_err);
            sum = _sum;
        });
    }
}, function(_index) {
    if (28 === (_done & 28)) {
        triggers.splice(_index, 1);
        a = _a;
        b = _b;
        c = _c;
    }
} ];

function trigger(_flag) {
    _done |= _flag;
    for (var i = triggers.length - 1; i >= 0; i--) {
        triggers[i](i);
    }
}

foo(function(_err, __1) {
    if (_err) return cb(_err);
    _1 = __1;
    trigger(1);
});

foo(function(_err, __2) {
    if (_err) return cb(_err);
    _2 = __2;
    trigger(2);
});

foo(function(_err, _3) {
    if (_err) return cb(_err);
});

var m;

var x = 0, y = 1, z;

foo(function(_err, __a) {
    if (_err) return cb(_err);
    _a = __a;
    trigger(4);
});

foo(function(_err, __b) {
    if (_err) return cb(_err);
    _b = __b;
    trigger(8);
});

foo(function(_err, __c) {
    if (_err) return cb(_err);
    _c = __c;
    trigger(16);
});