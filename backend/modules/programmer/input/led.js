// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-icpo project <http://lukasz.walukiewicz.eu/p/walkner-icpo>

'use strict';

module.exports = function setUpLedInput(app, programmerModule)
{
  return function loadLedData()
  {
    programmerModule.changeState({ledStatus: 'loaded'});
  };
};
