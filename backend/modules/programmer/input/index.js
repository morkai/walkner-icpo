// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

module.exports = function setUpInput(app, programmerModule)
{
  programmerModule.input = {
    serviceTag: require('./serviceTag')(app, programmerModule),
    driver: require('./driver')(app, programmerModule),
    gprs: require('./gprs')(app, programmerModule),
    led: require('./led')(app, programmerModule)
  };
};
