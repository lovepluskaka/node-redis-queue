const fs = require('fs');
const path = require('path');
const redisQueue = require('../../index');//实际中使用 require('node-redis-queue-lh')
const Async = redisQueue.async;
const Queue = redisQueue.queue;


class transmit{
   constructor(ori,tar,watching,cb){
      let self = this;
        self.original = ori;//原文件夹
        self.target = tar;//目标文件夹
        self.watching = watching;//监听
        self.cb = cb;//回调函数
        // self.isrunning = true;//任务是否在执行
        self.listName = "files";

        self.client = new Queue({ db:3 });//初始化插件

        fs.readdir(self.original,(err,data)=>{
          if(err){
            return self.cb('无法读取文件夹中的文件');
          }
          if(self.watching){
             self.watch();
          }
          console.log(data);
          if(data && data.length){
            self.client.add(self.listName,data).then((count)=>{
                 if(count){
                    self.transmitFile(self.cb);
                 }else{
                   self.cb("存储文件失败");
                 }
            })
          }
      });
   }
   //这个方法写了一个递归，每次文件变化，文件名都进入队列被消耗
   transmitFile(cb){
      let self = this;
      self.client.shift([self.listName],0,(err,result)=>{
          if(err){
             return cb(err);
          }
          console.log("file is ",result[1]);
          let itemFile = result[1];
          let filepath = path.join(self.original,itemFile);
          let targetPath = path.join(self.target,itemFile);
          let readStram = fs.createReadStream(filepath);
          let writeStram = fs.createWriteStream(targetPath);
          readStram.on('error',(err)=>{
              if(err){
                  self.delete(targetPath,(error)=>{

                      if(error){
                        console.log('出现错误');
                        return cb(`删除目标文件出错${error},读取文件出错${err},任务中断`);
                      }
                      else{
                        self.transmitFile(cb);
                      }
                  })
              }
          })
          readStram.pipe(writeStram);
          writeStram.on('close',function(){
              self.transmitFile(cb);
          })
      })
  }

  watch(){
     console.log('您已经开启文件监听模式');
     let self = this;
     let countName = 0;
     fs.watch(self.original,(eventType,filename)=>{
         if(filename != '.DS_Store'&&filename){
             self.client.add(self.listName,filename,function(err){
                  return self.cb(err);
             })
         }
     })
  }

  delete(filename,cb){
     let self = this;
     fs.unlink(filename,(err)=>{
        if(err){
            cb(err);
        }else{
            cb();
        }
     })
  }
}


let original = path.join(__filename,'../','newfile','/old/');
let target = path.join(__filename,'../','newfile','/new/');


new transmit(original,target,true,function(err){
   if(err){
      console.log(err);
   }else{
     console.log('success!');
   }
});
