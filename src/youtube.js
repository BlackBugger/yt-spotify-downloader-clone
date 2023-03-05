import axios from "axios"
const KEY = 'AIzaSyAbv5Y7iVusXiGKv75mru5G_Y4jNZUTtPY';



export default axios.create({
    baseURL: 'https://wwww.googleapis.com/youtube/v3/',
    params: {
        part: 'snippet',
        maxResults: 5,
        key: KEY
    }
    
}) 
