var a, b;

foo(function(_err, _a) {
    if (_err) return cb(_err);
    a = _a;
    foo(a, function(_err, _b) {
        if (_err) return cb(_err);
        b = _b;
        console.log("b=" + b);
    });
    console.log("a=" + a);
});