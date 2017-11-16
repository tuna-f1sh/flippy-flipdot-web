![App preview](public/img/preview.png)

Emulator and GUI for my [Hanover Flipdot Display
driver](https://github.com/tuna-f1sh/node-flipdot)

## Install

```
git clone https://github.com/tuna-f1sh/flippy-flipdot-web
cd flippy-flipdot-web
npm install
node app.js --help
```

## Emulate

```
node app.js --emulate
```

## Debug

Pre-append `DEBUG=flipdot*,ascii*` to run commands, eg:

```
DEBUG=flipdot*,ascii* node app.js -p /dev/ttyUSB0 -r 7 -c 56
```

## Notes

Whilst I have designed the code to theoretically scale to any display, it has
not been hardware tested (I only have a 56x7). The
[flipdot-display](https://github.com/tuna-f1sh/node-flipdot) might need some
tweaking - PRs welcome!
