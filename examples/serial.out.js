var a, b;

foo(function(_err, _r1) {
    if (_err) return cb(_err);
    a = _r1;
    foo(a, function(_err, _r2) {
        if (_err) return cb(_err);
        b = _r2;
    });
});
