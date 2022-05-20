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
var pingIntervalHandle;
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
    setIndicatorColour(result.err ? "rgb(230,0,0)" : "rgb(0,200,0)");
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
    elem.firstChild.innerText = job.title;
    elem.addEventListener("click", clickHandler);
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

function clickHandler(e){
    let elem = e.target.matches("#job-list > li") ? e.target : e.target.parentElement;
    let isError = elem.classList.contains("error");
    if(e.target.tagName == 'BUTTON'){
        switch(e.target.innerText){
            case "Delete":
                if(isError) return elem.remove();
                if(confirm(`Are you sure you want to delete the job "${elem.firstChild.innerText}"?`)){
                    deleteJob(elem.id);
                    API("job",{id:elem.id},"delete").then(result=>{
                        if(result.err)console.log(result.err);
                    });
                }
            break;
            default:

            break;
        }
        return;
    }
    if(!isError) API("job",{_id:elem.id,finished:toggleFinish(elem.id)},"put");
    //socket.emit("finish job",{un:toggleFinish(elem.firstChild.innerText),title:elem.firstChild.innerText});
}

NewJobForm.addEventListener("submit", async e=>{
    e.preventDefault();
    let title = NewJobInput.value;
    let jobElem = createJobItem({title});
    jobElem.classList.add("pending");
    NewJobInput.value = "";
    let result = await API("job", {title}, "post");
    if(result.err || result.body.error){
        jobElem.classList.add("error");
        //return console.error(result);
    }
    jobElem.classList.remove("pending");
    jobElem.id = result.body._id;
    console.log(result);
    JobList[jobElem.id] = result.body;
    JobList[jobElem.id].elem = jobElem;
});

const RefreshButton = document.getElementById("refresher");

async function load(){
    JobListElem.innerHTML = "Loading...";
    RefreshButton.disabled = true;
    NewJobSubmit.disabled = true;
    let result = await API("jobs");
    if(result.err)
        return JobListElem.innerHTML = "Error loading jobs.<br>Please check that this is <a href='https://whizzscot.github.io/planner'>whizzscot.github.io/planner</a>, and you are connected to the internet.";
    if(result.body.err)
        return JobListElem.innerHTML = "Error loading jobs.<br>Please reload page.";
    let jobs = result.body.items;
    JobListElem.innerHTML = "";
    RefreshButton.disabled = false;
    NewJobSubmit.disabled = false;
    //console.log(jobs);
    jobs.forEach(addJob);
}

load();
RefreshButton.addEventListener("click",load);