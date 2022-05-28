const version = "3.3";

const ClientDate = Date.now();

async function checkForUpdate(){
    try{
        let response = await fetch("https://api.github.com/repos/Whizzscot/planner/branches/main");
        let data = await response.json();
        let lastUpdateTime = new Date(data.commit.commit.author.date).valueOf();
        return lastClientUpdate < lastUpdateTime ? 1 : 0;
    } catch(err){
        return -1;
    }
}

document.head.querySelector("title").innerText += version;

var JobList = {};
const API_DIRECTORY = "https://elliotmcleish.wixsite.com/planner";

async function API(name, args = {}, method = "get"){
    try{
        let url = `${API_DIRECTORY}/_functions/${name}`;
        url+="?";
        for(let argname in args){
            let value = (typeof args[argname] == 'string') ? args[argname] : JSON.stringify(args[argname]);
            url+=`${encodeURIComponent(argname)}=${encodeURIComponent(value)}&`;
        }
        url = url.slice(0,-1);
        let response = await fetch(url, {method});
        let isJSON = response.headers.get("Content-Type").split(";")[0] == "application/json";
        return {
            err:null,
            response,
            body: await response[isJSON ? "json" : "text"](),
        };
    } catch(err) {
        if(err.message == "Failed to fetch" && name!= "ping")
            console.warn(`API function call "${name}()" with method "${method}" failed.`);
        return {err};
    }
}

function setIndicatorColour(col){
    document.getElementById("indicator").style.backgroundColor = col;
}

const pingLight = document.getElementById("pinging");
const responseLight = document.getElementById("ping-response");
var pingIntervalHandle;
var lastClientUpdate = Date.now();
document.getElementById("send pings").addEventListener("input",e=>{
    if(e.target.checked){
        ping();
        pingIntervalHandle = window.setInterval(ping, 10000);
    }else{
        window.clearInterval(pingIntervalHandle);
        setIndicatorColour(null);
    }
});

async function ping(){
    pingLight.style.animation = 'none';
    pingLight.offsetHeight;
    pingLight.style.animation = null;
    pingLight.style.animationIterationCount = 1;
    let result = await API("ping");
    if(!document.getElementById("send pings").checked) return;
    responseLight.style.animation = 'none';
    responseLight.offsetHeight;
    responseLight.style.animation = null;
    responseLight.style.animationIterationCount = 1;
    if(result.err) return setIndicatorColour("rgb(230,0,0");
    if((new Date(result.body).valueOf() - lastClientUpdate) > 0)
        return setIndicatorColour("rgb(230,230,0");
    setIndicatorColour("rgb(0,200,0)");
}

const JobListElem = document.getElementById("job-list");
const NewJobForm = document.getElementById("new-job-form");
const NewJobInput = NewJobForm.firstElementChild;
const NewJobSubmit = NewJobForm.lastElementChild;
const JobTemplate = document.querySelector("li.template");

function createJobItem(job){
    let elem = JobTemplate.cloneNode(true);
    elem.classList.remove("template");
    if(job.finished) elem.classList.add("finished");
    if(job._id) elem.id = job._id;
    let titleElem = elem.querySelector(".title");
    titleElem.innerText = job.title;
    titleElem.addEventListener("focus", selectEnd);
    titleElem.addEventListener("input", titleInputHandler);
    titleElem.addEventListener("pointerup", clickHandler);
    elem.addEventListener("click", clickHandler);
    elem.addEventListener("mousedown", dragStart);
    titleElem.addEventListener("touchstart", dragStart);
    elem.addEventListener("mousemove", drag);
    titleElem.addEventListener("touchmove", drag);
    elem.addEventListener("mouseup", dragEnd);
    titleElem.addEventListener("touchend", dragEnd);
    return JobListElem.appendChild(elem);
}

function addJob(job, elem){
    JobList[job._id] = job;
    JobList[job._id].elem = createJobItem(job);
    return JobList[job._id];
}

function deleteJob(id){
    JobList[id].elem.remove();
    delete JobList[id];
}

function toggleFinish(id){
    if(JobList[id].finished){
        JobList[id].finished = false;
        JobList[id].elem.classList.remove("finished");
    }else{
        JobList[id].finished = true;
        JobList[id].elem.classList.add("finished");
    }
    return JobList[id].finished;
}

function clientUpdate(response){
    if(response.err || response.body.error)
        return console.log(response);
    lastClientUpdate = Date.now();
}

function clickHandler(e){
    let elem = e.target;
    while(!elem.matches("#job-list > li")){
        elem = elem.parentElement;
    }
    let isError = elem.classList.contains("error");
    if(e.target.tagName == 'BUTTON'){
        switch(e.target.innerText){
            case "Delete":
                if(isError) return elem.remove();
                if(confirm(`Are you sure you want to delete the job "${JobList[elem.id].title}"?`)){
                    deleteJob(elem.id);
                    API("job",{id:elem.id},"delete").then(clientUpdate);
                }
                order = Array(...JobListElem.childNodes).map(elem=>{return elem.id});
            break;
            case "Edit":
                elem.querySelector(".title").contentEditable = 'true';
                elem.querySelector(".title").focus();
                e.target.innerText = "Save";
                e.target.nextElementSibling.innerText = "Cancel";
            break;
            case "Save":
                let title = elem.querySelector(".title").innerText;
                JobList[elem.id].title = title;
                API("job",{_id:elem.id,title},"put").then(clientUpdate)
            case "Cancel":
                elem.querySelector(".title").contentEditable = 'inherit';
                elem.querySelector(".title").innerText = JobList[elem.id].title;
                elem.querySelector(".button1").innerText = "Edit";
                elem.querySelector(".button2").innerText = "Delete";
            break;
            default:
                console.log("Unexpected Button with no function to call",e.target.innerText);
            break;
        }
        return;
    }
    if(!isError && elem.querySelector(".title").contentEditable != 'true' && !elem.classList.contains("dragging")) API("job",{_id:elem.id,finished:toggleFinish(elem.id)},"put").then(clientUpdate);
}

var order = Array(...JobListElem.childNodes).map(elem=>{return elem.id});
var draggedItem = null;

function dragStart(e){
    draggedItem = e.target;
    while(!draggedItem.matches("#job-list > li"))
        draggedItem = draggedItem.parentElement;
    if(draggedItem.querySelector(".title").contentEditable == 'true')
        draggedItem = null;
    if(e.type == "touchstart")
        e.preventDefault();
}

function drag(e){
    if(!draggedItem) return;
    let elem = e.target;
    if(e.type == 'touchmove'){
        elem = null;
        let touchY = e.targetTouches[0].clientY;
        for(let item of JobListElem.childNodes){
            let itemBox = item.getBoundingClientRect();
            if(touchY < itemBox.bottom){
                // console.log(item);
                if(touchY > itemBox.top) elem = item;
                break;
            }
        }
        //console.log(elem);
        if(!elem) return;
    }else{
        while(!elem.matches("#job-list > li")){
            elem = elem.parentElement;
        }
    }
    draggedItem.classList.add("dragging");
    if(elem.isSameNode(draggedItem)) return;
    let lower = (elem.getBoundingClientRect().y-draggedItem.getBoundingClientRect().y) < 0;
    if(lower){
        JobListElem.insertBefore(draggedItem, elem);
    }else if(elem.nextElementSibling){
        JobListElem.insertBefore(draggedItem, elem.nextElementSibling);
    }else{
        JobListElem.appendChild(draggedItem);
    }
}

function dragEnd(e){
    if(!draggedItem) return;
    let newOrder = Array(...JobListElem.childNodes).map(elem=>{return elem.id});
    if(newOrder.length != order.length || !order.every((id,val)=>{return newOrder[val] == id})){
        order = newOrder;
        UpdateOrderButton.disabled = false;
        UpdateOrderButton.style.top = "1em";
    }
    draggedItem.classList.remove("dragging");
    draggedItem = null;
}

function titleInputHandler(e){
    let caretOffset = window.getSelection().focusOffset;
    let text = e.target.textContent;
    e.target.innerText = text;
    if(text) moveCaret(e.target.firstChild, caretOffset);
    if(e.inputType == 'insertParagraph') e.target.parentElement.querySelector(".button1").click();
}

function selectEnd(e){
    // setSelectionRange doesn't work on <span> elements.
    // let length = e.target.innerText.length;
    // e.target.setSelectionRange(length, length);
    /*let r = document.createRange();
    let node = e.target.firstChild;
    let endIndex = node.textContent.length;
    r.setStart(node, endIndex);
    r.setEnd(node, endIndex);
    let s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);*/
    moveCaret(e.target.firstChild, e.target.textContent.length);
}

function moveCaret(node, index){
    let r = document.createRange();
    r.setStart(node, index);
    r.setEnd(node, index);
    let s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
}

NewJobForm.addEventListener("submit", async e=>{
    e.preventDefault();
    let title = NewJobInput.value;
    if(!NewJobInput.value) return NewJobInput.focus();
    let jobElem = createJobItem({title});
    jobElem.classList.add("pending");
    NewJobInput.value = "";
    let result = await API("job", {title}, "post");
    if(result.err || result.body.error){
        jobElem.classList.add("error");
        //return console.error(result);
    }
    lastClientUpdate = Date.now();
    jobElem.classList.remove("pending");
    jobElem.id = result.body._id;
    // console.log(result);
    JobList[jobElem.id] = result.body;
    JobList[jobElem.id].elem = jobElem;
    order = Array(...JobListElem.childNodes).map(elem=>{return elem.id});
});

const RefreshButton = document.getElementById("refresher");
const UpdateOrderButton = document.getElementById("update-order");

UpdateOrderButton.addEventListener("click",()=>{
    API("order",{order},"put").then(clientUpdate);
    UpdateOrderButton.disabled = true;
    UpdateOrderButton.style.top = null;
})

async function load(){
    JobListElem.innerHTML = "Loading Jobs...";
    RefreshButton.disabled = true;
    NewJobSubmit.disabled = true;
    UpdateOrderButton.disabled = true;
    UpdateOrderButton.style.top = null;
    let result = await API("jobs");
    RefreshButton.disabled = false;
    if(result.err)
        return JobListElem.innerHTML = "Error loading jobs.<br>Please check that this is <a href='https://whizzscot.github.io/planner'>whizzscot.github.io/planner</a>, and you are connected to the internet.";
    if(result.body.err)
        return JobListElem.innerHTML = "Error loading jobs.<br>Please reload page.";
    let jobs = result.body.items;
    JobListElem.innerHTML = "";
    NewJobSubmit.disabled = false;
    //console.log(jobs);
    jobs.forEach(addJob);
    lastClientUpdate = Date.now();
    order = Array(...JobListElem.childNodes).map(elem=>{return elem.id});
    ping();
    let needUpdate = await checkForUpdate();
    if(needUpdate == 1) alert("Your Client is out of Date! Please refresh page.");
}

load();
RefreshButton.addEventListener("click",load);