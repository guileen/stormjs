var a, b, c;

var count = 2;

function update() {
    if (--count === 0) {
        foo(a, b, function(_err, _r3) {
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

foo(function(_err, _r2) {
    if (_err) return cb(_err);
    b = _r2;
    console.log("b=" + b);
    update();
});