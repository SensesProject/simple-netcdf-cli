# NetCDF

## Installing (macOS)

You need to install [netcdf](https://www.unidata.ucar.edu/downloads/netcdf/index.jsp) first. You can do that using homebrew: `brew install netcdf`.

If you run into `brew link` related troubles, you might need to make `/usr/local/share` writable. Do this by running `sudo chown -R [user]:admin /usr/local/share`. Then run `brew link netcdf`.

Now run `yarn`. Modify `index.js` and run `node index.js`
