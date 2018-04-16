pop_item=function(obj,src){
	var items=obj.getItems();
	if (items.length){
		var keys='1234567890qwertyuiop';
		obj.pop(src);
		obj.save_hook=_.merge({},xui.$cache.hookKey);
		xui.$cache.hookKey={};
		xui.Event.keyboardHook("esc",0,0,0,function(){
			obj.hide();
		});
		var k=0;
		for (i in items){
			if(k>19){
				break;
			}
			if(items[i].type=='split'){
				continue;
			}
			var key=keys[k];
			xui.Event.keyboardHook(key,0,0,0,function(index){
				obj.fireItemClickEvent(items[index].id);
			},[i],obj);
			k++;
		}
	}
}

pop_onHide=function(obj){
	var prf=obj.boxing();
	if(_.isDefined(prf.save_hook)){
		xui.$cache.hookKey=_.merge({},prf.save_hook);
		delete prf.save_hook;
	}
}
