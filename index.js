var fs   = require('fs')
var join = require('path').join

var context = require('fuse-bindings').context


function ExclFS(lowerLayer)
{
  if(!(this instanceof ExclFS)) return new ExclFS(lowerLayer)


  var filesInUse = {}

  function canUse(path, uid)
  {
    var file = filesInUse[path]
    if(!file) return true

    return file.uid === uid
  }


  this.getattr = function(path, callback)
  {
    fs.lstat(join(lowerLayer, path), function(error, stats)
    {
      if(error) return callback(error)

      var uid = context().uid

      var file = filesInUse[path]
      if(file && file.uid === uid) stats.uid = uid

      callback(null, stats)
    })
  }


  // Directories

  this.readdir = function(path, callback)
  {
    fs.readdir(join(lowerLayer, path), function(error, files)
    {
      if(error) return callback(error)

      var uid = context().uid

      callback(null, files.filter(function(entry)
      {
        return canUse(join(path, entry), uid)
      }))
    })
  }


  // Symlinks

  this.readlink = function(path, callback)
  {
    fs.readlink(join(lowerLayer, path), callback)
  }


  // Files

  this.access = function(path, mode, callback)
  {
    fs.access(join(lowerLayer, path), mode, function(error)
    {
      if(error) return callback(error)

      callback(!canUse(path, context().uid))
    })
  }
  this.open = function(path, flags, callback)
  {
    fs.open(join(lowerLayer, path), flags, function(error, fd)
    {
      if(error) return callback(error)

      var file = filesInUse[path]
      if(!file)
        filesInUse[path] = file =
        {
          counter: 0
          uid: context().uid
        }

      file.counter++

      callback(null, fd)
    })
  }
  this.read = function(path, fd, buffer, length, position, callback)
  {
    fs.read(fd, buffer, 0, length, position, function(error, bytesRead)
    {
      if(error) return callback(error)

      callback(bytesRead)
    })
  }
  this.write = function(path, fd, buffer, length, position, callback)
  {
    fs.write(fd, buffer, position, function(error, bytesWritten)
    {
      if(error) return callback(error)

      callback(bytesWritten)
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


module.exports = ExclFS
