1.1.3 @ 2014-12-05
==================

  * Changed the result resetting to also occur before the first data input after
    a finished programming.

1.1.2 @ 2014-12-05
==================

  * Fixed the programming not starting when all input data was loaded successfully
    in the automatic mode.
  * Changed the 12NC input data focusing to focus the next empty field OR the one
    with an error.

1.1.1 @ 2014-11-28
==================

  * Changed the history entries exporting to be exported only 25 at once (and not all).
  * Changed CLO profile parsing to multiply the hours value by 500 before handing
    the JSON to the programmer.

1.1.0 @ 2014-10-20
==================

  * Fixed a display error of the Error property showing `error:0` if the error code is
    equal to a string `0`.
  * Fixed an error when clicking on the No data row on the History list page.
  * Changed the verification to be skipped after the programmer output file is copied
    to the verification input directory and not before.
  * Added a progress bar above the Cancel button on the Programmer page.

1.0.2 @ 2014-10-14
==================

  * Changed the input file loading process to force a reload if the same input value was
    sent and the current status of that input is not loaded.

1.0.1 @ 2014-10-12
==================

  * Changed the `configurationDesignation` option matching to allow `-` and whitespace
    characters around the `/` character in a lamp type.
  * Added the missing user guide.

1.0.0 @ 2014-09-24
==================

  * Initial release.
