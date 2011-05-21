var a, c, _1, _done = 0;

function trigger(_flag) {
    if (3 === ((_done |= _flag) & 3)) {
        foo(a, _1, function(_err, _c) {
            if (_err) return cb(_err);
            c = _c;
            console.log("c=" + c);
        });
    }
}

foo(function(_err, _a) {
    if (_err) return cb(_err);
    a = _a;
    console.log("a=" + a);
    trigger(1);
});

foo(function(_err, __1) {
    if (_err) return cb(_err);
    _1 = __1;
    trigger(2);
});