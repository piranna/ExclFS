var fs   = require('fs')
var join = require('path').join

var context = require('fuse-bindings').context
var filter  = require('async').filter


function ExclFS(lowerLayer)
{
  if(!(this instanceof ExclFS)) return new ExclFS(lowerLayer)


  function getFilePath(path, callback)
  {
    fs.realpath(join(lowerLayer, path), callback)
  }


  var filesInUse = {}


  this.getattr = function(path, callback)
  {
    getFilePath(path, function(error, path)
    {
      if(error) return callback(error)

      fs.stat(path, function(error, stats)
      {
        if(error) return callback(error)

        var mode = stats.mode
        stats.mode = mode & 7007 || (mode & 0070) << 3

        var file = filesInUse[path]
        if(file)
        {
          stats.uid = file.uid
          stats.gid = file.gid
        }
        else
        {
          var ctx = context()

          stats.uid = ctx.uid
          stats.gid = ctx.gid
        }

        callback(null, stats)
      })
    })
  }


  // Directories

  function showEntry(path, uid, entry, callback)
  {
    path = join(path, entry)

    getFilePath(path, function(error, path)
    {
      if(error) return callback(false)

      var file = filesInUse[path]
      if(file && file.uid === uid) return callback(true)

      fs.stat(path, function(error, stats)
      {
        if(error) return callback(error)

        callback(stats.mode & (file ? 0007 : 0077))
      })
    })
  }

  this.readdir = function(path, callback)
  {
    fs.readdir(join(lowerLayer, path), function(error, files)
    {
      if(error) return callback(error)

      var uid = context().uid

      filter(files,
        showEntry.bind(undefined, path, uid),
        callback.bind(undefined, null))
    })
  }


  // Symlinks

  this.readlink = getFilePath


  // Files

  this.open = function(path, flags, callback)
  {
    getFilePath(path, function(error, path)
    {
      if(error) return callback(error)

      fs.open(path, flags, function(error, fd)
      {
        if(error) return callback(error)

        var file = filesInUse[path]
        if(!file)
        {
          var ctx = context()

          filesInUse[path] = file =
          {
            counter: 0,
            uid: ctx.uid,
            gid: ctx.gid
          }
        }

        file.counter++

        callback(null, fd)
      })
    })
  }
  this.release = function(path, fd, callback)
  {
    fs.close(fd, function(error)
    {
      if(error) return callback(error)

      var file = filesInUse[path]
      file.counter--
      if(!file.counter)
        delete filesInUse[path]

      callback()
    })
  }
}


// Files

ExclFS.prototype.read = function(path, fd, buffer, length, position, callback)
{
  fs.read(fd, buffer, 0, length, position, callback)
}
ExclFS.prototype.write = function(path, fd, buffer, length, position, callback)
{
  fs.write(fd, buffer, position, callback)
}


module.exports = ExclFS
