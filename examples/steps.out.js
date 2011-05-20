var a, c, _r2, count = 2;

function update() {
    if (--count === 0) {
        foo(a, _r2, function(_err, _r3) {
            if (_err) return cb(_err);
            c = _r3;
            console.log("c=" + c);
        });
    }
}

foo(function(_err, _r1) {
    if (_err) return cb(_err);
    a = _r1;
    console.log("a=" + a);
    update();
});

foo(function(_err, __r2) {
    if (_err) return cb(_err);
    _r2 = __r2;
    update();
});