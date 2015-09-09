var fs   = require('fs')
var join = require('path').join

var context = require('fuse-bindings').context


const nullSet =
{
  has: function(value)
  {
    return false
  }
}


function ExclFS(lowerLayer)
{
  if(!(this instanceof ExclFS)) return new ExclFS(lowerLayer)


  var filesInUse = new Set()
  var filesInUse_byUid = {}

  function canUse(path, inUse_byUid)
  {
    return inUse_byUid.has(path) || !filesInUse.has(path)
  }


  this.getattr = function(path, callback)
  {
    fs.lstat(join(lowerLayer, path), callback)
  }


  // Directories

  this.readdir = function(path, callback)
  {
    fs.readdir(join(lowerLayer, path), function(error, files)
    {
      if(error) return callback(error)

      var uid = context().uid
      var inUse_byUid = filesInUse_byUid[uid] || nullSet

      callback(null, files.filter(function(entry)
      {
        return canUse(join(path, entry), inUse_byUid)
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

      var uid = context().uid
      var inUse_byUid = filesInUse_byUid[uid] || nullSet

      callback(!canUse(path, inUse_byUid))
    })
  }
  this.open = function(path, flags, callback)
  {
    fs.open(join(lowerLayer, path), flags, function(error, fd)
    {
      if(error) return callback(error)

      filesInUse.add(path)

      var uid = context().uid
      var inUse_byUid = filesInUse_byUid[uid]
      if(!inUse_byUid)
        filesInUse_byUid[uid] = inUse_byUid = new Set()

      inUse_byUid.add(path)

      callback(null, fd)
    })
  }
  this.read = function(path, fd, buffer, length, position, callback)
  {
    fs.read(fd, buffer, 0, length, position, function(error, bytesRead, buffer)
    {
      if(error) return callback(error)

      return callback(bytesRead)
    })
  }
  this.write = function(path, fd, buffer, length, position, callback)
  {
    fs.write(fd, buffer, position, function(error, written, string)
    {
      if(error) return callback(error)

      return callback(written)
    })
  }
  this.release = function(path, fd, callback)
  {
    fs.close(fd, function(error)
    {
      if(error) return callback(error)

      filesInUse.delete(path)

      var uid = context().uid
      var inUse_byUid = filesInUse_byUid[uid]

      inUse_byUid.delete(path)
      if(!inUse_byUid.size)
        delete filesInUse_byUid[uid]

      callback()
    })
  }
}


module.exports = ExclFS
