var _done = 0;

function trigger(_flag) {
    if (3 === ((_done |= _flag) & 3)) {
        (function next(i) {
            if (i < 100) {
                foo(a, b, c, function(_err, _c) {
                    if (_err) return cb(_err);
                    c = _c;
                });
                next(++i);
            }
        })(0);
    }
}

var a = 0, b = 0, c;

(function next(i) {
    if (i < 100) {
        foo(a, function(_err, _a) {
            if (_err) return cb(_err);
            a = _a;
        });
        next(++i);
    } else {
        trigger(2);
    }
})(0);

(function next(i, j, after) {
    if (i < 100) {
        foo(b, j, function(_err, _b) {
            if (_err) return cb(_err);
            b = _b;
        });
        j = bar(j);
        b += 1;
        next(++i, j);
    } else after();
})(0, 0, function() {
    console.log(b);
    trigger(1);
});