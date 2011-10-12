var sum, a, b, c, d, _1, _2, _a, _b, _c, _x_x, _x_y, _x_x_y, _x_y_x, _done = 0;

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
}, function(_index) {
    if (96 === (_done & 96)) {
        triggers.splice(_index, 1);
        x.x = _x_x;
    }
}, function(_index) {
    if (224 === (_done & 224)) {
        triggers.splice(_index, 1);
        x["y"] = _x_y;
    }
}, function(_index) {
    if (480 === (_done & 480)) {
        triggers.splice(_index, 1);
        x["x"].y = _x_x_y;
    }
}, function(_index) {
    if (992 === (_done & 992)) {
        triggers.splice(_index, 1);
        x.y.x = _x_y_x;
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

foo(function(_err, _x) {
    if (_err) return cb(_err);
    x = _x;
    trigger(32);
});

foo(function(_err, __x_x) {
    if (_err) return cb(_err);
    _x_x = __x_x;
    trigger(64);
});

foo(function(_err, __x_y) {
    if (_err) return cb(_err);
    _x_y = __x_y;
    trigger(128);
});

foo(function(_err, __x_x_y) {
    if (_err) return cb(_err);
    _x_x_y = __x_x_y;
    trigger(256);
});

foo(function(_err, __x_y_x) {
    if (_err) return cb(_err);
    _x_y_x = __x_y_x;
    trigger(512);
});