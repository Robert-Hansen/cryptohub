app.controller('DashboardController', function ($scope, $timeout) {
    // Open a WebSocket connection
    var socket = new WebSocket('wss://api.bitfinex.com/ws/2');

    var vm = this;
    vm.currencies = [];
    vm.userCurrencies = {};
    var subscribed = [];
    
    // define our database
    var db = new Dexie('cryptoDB');
    db.version(1).stores({
        currencies: 'key,value'
    });

    // open our database
    db.open().catch(function(error) {
        console.log('db error: ', error);
    });

    vm.isNegative = function(value) {
        return value < 0;
    };

    db.currencies.each(function (currency) {
        vm.userCurrencies[currency.key] = currency.value;
    });

    vm.getTotalProfit = function() {
        var sum = 0;

        angular.forEach(vm.userCurrencies, function(value, key) {
            db.currencies.put({ key: key, value: value })
            for (var i = 0, currencyLength = vm.currencies.length; i < currencyLength; i++) {
                var currency = vm.currencies[i];
                if (currency.key == key) {
                    sum += currency.market_price * Number(value);
                }
            }
        });
        
        return "$" + accounting.formatNumber(sum);
    };

    function subscribeTo(names) {
        names.forEach(function(name) {
            var stream = JSON.stringify({
                event: 'subscribe',
                channel: 'ticker',
                symbol: 't'+name.toUpperCase()+'USD'
            });
            socket.send(stream);
        });
    }

    socket.onopen = function (event) {
        subscribeTo(['btc', 'eth', 'ltc', 'edo', 'avt',
            'omg', 'neo', 'san', 'eos', 'iot', 'zec', 'xrp'])
    };

    function round(value, decimals) {
        return Number(Math.round(value + 'e' + decimals) +'e-' + decimals);
    }

    accounting.settings = {
        currency: {
            symbol : "$",   // default currency symbol is '$'
            format: "%s%v", // controls output: %s = symbol, %v = value/number (can be object: see below)
            decimal : ".",  // decimal point separator
            thousand: ",",  // thousands separator
            precision : 2   // decimal places
        },
        number: {
            precision : 2,  // default precision on numbers is 0
            thousand: ",",
            decimal : "."
        }
    };

    socket.onmessage = function (event) {
        var res = JSON.parse(event.data);

        if (res.hasOwnProperty('event') && res.event === "subscribed") {
            subscribed[res.chanId] = res.pair;
        }

        if (res[1] instanceof Array) {
            $timeout(function () {

                var data = {
                    key: subscribed[res[0]].substring(0, 3).toLowerCase(),
                    daily_change: res[1][4],
                    daily_change_percent: round(res[1][5] * 100, 2),
                    last_price: accounting.formatNumber(round(res[1][6], 2)),
                    market_price: res[1][6],
                    daily_volume: round(res[1][7], 2),
                    daily_high: round(res[1][8], 2),
                    daily_low: round(res[1][9], 2)
                };

                for (var i = 0; i < vm.currencies.length; i++) {
                    var currency = vm.currencies[i];
                    if (currency.key === data.key) {
                        currency.daily_change = data.daily_change;
                        currency.daily_change_percent = data.daily_change_percent;
                        currency.last_price = data.last_price;
                        currency.market_price = data.market_price;
                        currency.daily_volume = data.daily_volume;
                        currency.daily_high = data.daily_high;
                        currency.daily_low = data.daily_low;
                        return;
                    }
                }
                vm.currencies.push(data);
            });
        }
    }

});
