var fs   = require('fs')
var join = require('path').join

var context = require('fuse-bindings').context
var filter  = require('async').filter


function ExclFS(lowerLayer, whitelist)
{
  if(!(this instanceof ExclFS)) return new ExclFS(lowerLayer, whitelist)

  whitelist = (whitelist || []).map(RegExp)


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

        var ctx = context()

        var mode = stats.mode
        stats.mode = mode & ~0770

        if(stats.uid === ctx.uid)
          stats.mode |= mode & 0700
        else
          stats.mode |= (mode & 0070) << 3

        var file = filesInUse[path]
        if(file)
        {
          stats.uid = file.uid
          stats.gid = file.gid
        }
        else
        {
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

    getFilePath(path, function(error, filepath)
    {
      if(error) return callback(false)

      var file = filesInUse[filepath]
      if(!file)
      {
        // File not being used/owned, check if it's whitelisted
        for(var entry in whitelist)
          if(entry.test(path))
            return callback(true)
      }

      // Check if we are using the file ("owned" by us)
      else if(file.uid === uid) return callback(true)

      // Other users or not whitelisted, use 'group' & 'others' file permissions
      fs.stat(filepath, function(error, stats)
      {
        if(error) return callback(error)

        callback(stats.uid === uid || stats.mode & (file ? 0007 : 0077))
      })
    })
  }

  this.readdir = function(path, callback)
  {
    fs.readdir(join(lowerLayer, path), function(error, files)
    {
      if(error) return callback(error)

      filter(files,
             showEntry.bind(undefined, path, context().uid),
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

  // [ToDO] Move to server.js when we are ready for nan2
  this.options = ['dev', 'nonempty']
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
