//#region import
import React, { useEffect, useState } from 'react';
import { Keyboard } from 'react-native'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';

//Font Awesome
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import{NavigationContainer} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SQLite from 'react-native-sqlite-storage';
//#endregion

import envs from "./src/config/env"

//#region openDB
const db = SQLite.openDatabase(
  {
    name:'MoviesDB',
    location: 'default '
  },
  () => {},
  // error => {console.log(error)}
); 
//#endregion

const Stack = createStackNavigator();

//#region Home Page
function Home({ navigation }){
  //name = Input field text
  const [name, setName] = useState('');
  //searchName = name of movie used to call api. This is duplicated from name but name field is later emptied. 
  //searchName will be used on refresh and load more data 
  const [searchName, setSearchName] = useState('');
  //count = used to set page number for api call. This variable will be incremeted on every api call
  const [count, setCount] = useState('');
  //searchFor =  stores the "Results For: [movie name]" text
  const [searchFor, setSearchFor] = useState('');
  //lastFiveSearches = last five searched made by the user
  const [lastFiveSearches, setLastfivesearches] = useState([]);
  //moviesList = stores all the movies returned from the api
  const [moviesList, setMoviesList] = useState([]);
  const {api_key} = envs;
  const {api_url} = envs;
  //Create table to store recent searches
  createTable();

  //get last five searches
  useEffect(() => {
    getLastFiveSearches();
  }, [])

  //Get the movies list
  //This function is called when search is clicked
  const onPressHandler = async () => {
    Keyboard.dismiss();
    if (name.length == 0) {
       //input field is empty
       Alert.alert('Empty Field!', 'Please enter movie name.')
    } else {
      //Update Search name
       setSearchName(name);
       //Update "Results for" text
       setSearchFor("Results For: " + name);
       //Empty the input field
       setName("");
      try {
        //Insert into db the name of movie just searched
        await db.transaction(async (tx) => {
            await tx.executeSql(
                "INSERT INTO tbl_searches (Name) VALUES (?)",
                [name]
            );
            //Get last five searches
            getLastFiveSearches();
            //Get the movies
            getMovies(name);
        })
        } catch (error) {
            console.log(error);
        }
    }
  }

  //Get the details of a movie and open the details page
  //Parameter - id = id of the movie retuned from the api
  const displayDetails = async (id) =>{
    try {
      //Get the details of the movie
      const response = await fetch(api_url + '/movie/' + id + '?api_key=' + api_key);
      const movie_details = await response.json();
      const related_response = await fetch(api_url + '/movie/' + id + '/similar?api_key=' + api_key);
      const related = await related_response.json();
      const returnData = [];
      returnData.push(movie_details);
      returnData.push(related.results);
      navigation.navigate('Details', returnData);

    } catch (error) {
      console.error(error);
    } finally {
      //  setLoading(false);
    }
  }

  //Gets last five searched from db
  const getLastFiveSearches = () => {
    try {
      db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM tbl_searches ORDER BY ID DESC LIMIT 5',
          [],
          (tx, results) => {
            var temp = [];
            for (let i = 0; i < results.rows.length; ++i)
              temp.push(results.rows.item(i));
            setLastfivesearches(temp);
            // setLoading(false);
          }
        );
      });
    } catch (error) {
        console.log(error);
    }
  }

  //Get the movies
  //Parameter - name = name of movie seraching for
  const getMovies = async (name) => {
    try {
      //Set count 1
      setCount('1');
      const response = await fetch(api_url + '/search/movie?page=1&api_key=' + api_key + '&query='+name);
      const returnData = await response.json();
      //Check if any movies have returned and update the movies list
      if(returnData.results.length > 0)
        setMoviesList(returnData.results);
    } catch (error) {
      console.error(error);
    } finally {
    //  setLoading(false);
    }
  }

  //Load more data. This function is called when the user has scrolled to the bottom of the screen
  const GetMoreMovies = async () => {
    try {
      //get the count and add 1
      var counter = parseInt(count) + 1;
      setCount(counter);
      const response = await fetch(api_url + '/search/movie?page='+counter+'&api_key=' + api_key + '&query='+searchName);
      const returnData = await response.json();
      //If retuned data is not empty then add is to the movies list
      if(returnData.results.length > 0)
        setMoviesList([...moviesList, ...returnData.results]);
    } catch (error) {
      console.error(error);
    } finally {
    //  setLoading(false);
    }
  }

  //Remove a recent search. This function is called when the user click the x button on the recent searches
  //Parameter: ID = id of the recent search being deleted.
  const removeRecent = async (ID) => {
    try {
      await db.transaction(async (tx) => {
          await tx.executeSql(
              "DELETE FROM tbl_searches WHERE ID = (?)",
              [ID]
          );
          //Get the last fives searches again after the deletion
          getLastFiveSearches();
      })
    } catch (error) {
        console.log(error);
    }
  }

  //Search for movies using the recent search.
  //This function is called when the user clicks one of the last five searches
  const searchRecent = async (recent_name) => {
    if (recent_name.length == 0) {
      //input field is empty
      Alert.alert('Warning!', 'Please enter movie name.')
    } else {
      //Update Search name
      setSearchName(recent_name);
      //Update "Results for" text
       setSearchFor("Results For: " + recent_name);
       //Empty the input field
       setName("");
      try {
        //Insert into db the name of movie just clicked
        await db.transaction(async (tx) => {
            await tx.executeSql(
                "INSERT INTO tbl_searches (Name) VALUES (?)",
                [recent_name]
            );
            //Get last five searches
            getLastFiveSearches();
            //Get the movies
            getMovies(recent_name);
        })
        } catch (error) {
            console.log(error);
        }
    }
  }

  const [Refreshing, setRefreshing] = useState(false);

  //This function is called when the user refreshed the page
  const onRefresh = () => {
    setRefreshing(true);
    //Call the refresh function
    onRefreshHandler();
    setRefreshing(false);
  }

  //Get the movies list
  const onRefreshHandler = async () => {
    if (searchName.length == 0) {
      //input field is empty
        Alert.alert('Warning!', 'Please enter movie name.')
    } else {
      //Update Search name
        setSearchName(searchName);
         //Update "Results for" text
        setSearchFor("Results For: " + searchName);
        //Empty the input field
        setName("");
        try {
          //Get last five searches
          getLastFiveSearches();
          //Get the movies
          getMovies(searchName);
        } catch (error) {
            console.log(error);
        }
    }
  }

  //Setting for load more data so that GetMoreMovies is called when user scrolls to bottom of screen
  const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize}) => {
    const paddingToBottom = 0;
    return layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  };

  return (
    <ScrollView 
      keyboardShouldPersistTaps={'handled'}
      style={styles.body}
      onScroll={({nativeEvent}) => {
        if (isCloseToBottom(nativeEvent)) {
          GetMoreMovies();
        }
      }}
      refreshControl={
        <RefreshControl
          refreshing={Refreshing}
          onRefresh={onRefresh}
          colors={['#ff00ff']}
        />
      }
    >
    
    <View style={styles.center}>
      <Text style={styles.text_header}>React Native Test</Text>
        <TextInput
          style={styles.input}
          placeholder='Enter movie name'
          placeholderTextColor="#ffffff" 
          onChangeText={(value) => setName(value)}
          value = {name}
        />
        <Pressable
          onPress={onPressHandler}
          hitSlop={{ top: 10, bottom: 10, right: 10, left: 10 }}
          android_ripple={{color:'#00f'}}
          style={({ pressed }) => [
            { backgroundColor: pressed ? '##0002E5' : '#6200E5' },
            styles.button
          ]}
          >
          <Text style={styles.text_white}> {'Search'} </Text>
        </Pressable>
        
        <FlatList
          style={styles.history_box}
            numColumns={3}
            keyExtractor={(item,index)=>index.toString()}
            data={lastFiveSearches}
            renderItem={({item})=>(
              <View style={styles.recentBox}>
                <Text onPress={()=>searchRecent(item.name)} style={styles.recentText}>{item.name}</Text>
                <Text onPress={()=>removeRecent(item.ID)} style={styles.removerecent}>  x</Text>
              </View>
            )}
        />
        </View>
        <Text style={styles.text_white}>{searchFor}</Text>
        <FlatList
          scrollEnabled={true}
          numColumns={2}
          keyExtractor={(item,index)=>index.toString()}
          data={moviesList}
          renderItem={({item})=>(
            <View style={styles.movieContainer}>
              <Pressable onPress={()=>displayDetails(item.id)}>
                <Image
                style={styles.image_home}
                source={{uri:'https://image.tmdb.org/t/p/w500' + item.poster_path}}
                resizeMode='stretch'
                  
                />
              </Pressable>
            </View>
          )}
        />
    
    </ScrollView>
  );
}
//#endregion

//#region Details Page

function Details({ route, navigation }){
  //Stores all the details of the movie selected
  const [data, setData] = useState([]);
  //variable to decide if modal is to be shown or hidden
  const [showModal, setShowModal] = useState(false);
  //Contains the image url
  const [modalImage, setModalImage] = useState('');
  //variable for converted genres list as one string
  const [genres, setGenres] = useState('');
  //variable for converted spoken languages list as one string
  const [spokenLangs, setSpokenLangs] = useState('');
  //variable for the list of all realated movies
  const [relatedmoviesList, setRelatedmoviesList] = useState([]);
  const {api_key} = envs;
  const {api_url} = envs;
  
  //This function shows the modal to display company logos
  const showImageModal = (image_path) => {
    //set the image url
    setModalImage(image_path);
    if(image_path == null){
      //if no url is given then show alert
      Alert.alert('No Image', 'The logo for this production company is not available')
    }else
      //Url is given so open the modal
      setShowModal(true);
  }

  useEffect(() => {
    //Update the movie deatils
    setData(route.params[0]);
    //Update the related movies list
    setRelatedmoviesList(route.params[1]);
    //temporary storage of details to get genres and languages
    const this_data = route.params[0];
    //Get all genres as a string
    var first = true;
    for (let i = 0; i < this_data.genres.length; i++){
      if(first){
        var genre = this_data.genres[i].name;
        first = false;
      }
      else
        var genre = genre +  ', ' + this_data.genres[i].name;
      setGenres(genre);
    }
    //Get all spoken languages as a string
    first = true;
    for(let i = 0; i < this_data.spoken_languages.length; i++){
      if(first){
        var langs = this_data.spoken_languages[i].english_name;
        first = false;
      }else
        var langs = spokenLangs + ', ' + this_data.spoken_languages[i].english_name;
      setSpokenLangs(langs)
    }
  }, [])
  
  //Function to go back to the home screen
  const GoBack = () =>{
    try {
      navigation.navigate('Home');
    } catch (error) {
      console.error(error);
    }
  }

  //This function is called when the user clicks on one of the relaated movies
  //Get the details of a movie and open the details page
  //Parameter - id = id of the movie retuned from the api
  const displayDetails = async (id) =>{
    try {
      //Get the details of the movie
      const response = await fetch(api_url + '/movie/' + id + '?api_key=' + api_key);
      const movie_details = await response.json();
      const related_response = await fetch(api_url + '/movie/' + id + '/similar?api_key=' + api_key);
      const related = await related_response.json();
      const returnData = [];
      returnData.push(movie_details);
      returnData.push(related.results);
      navigation.push('Details', returnData);

    } catch (error) {
      console.error(error);
    }
  }

  return(
    <ScrollView style={styles.details_body}>

      <Modal
        visible={showModal}
        transparent
        onRequestClose={() =>
          setShowModal(false)
        }
        animationType='slide'
        hardwareAccelerated
      >
        <View style={styles.centered_view}>
          <View style={styles.image_modal}>
            <View style={styles.modal_body}>
            <Image
              style={styles.modal_image}
              source={{uri:'https://image.tmdb.org/t/p/w500' + modalImage}}
              resizeMode='stretch'
            />
            </View>
            <Pressable
              onPress={() => setShowModal(false)}
              style={styles.close_button}
              android_ripple={{color:'#fff'}}
            >
            <Text style={styles.text}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.details_top}>
        <Pressable onPress={()=>GoBack()}>
          <FontAwesomeIcon style={styles.back_arrow} icon={ faArrowLeft } />
        </Pressable>
        <View style={styles.center_title}>
          <Text style={styles.center_text_heading}>{data.title}</Text>
        </View>
      </View>
      <View style={styles.center}>
        <Text style={styles.text}>{data.tagline}</Text>
        <Image
          style={styles.image}
          source={{uri:'https://image.tmdb.org/t/p/w500' + data.poster_path}}
          resizeMode='stretch'
        />
      </View>
      <Text></Text>
      <Text style={styles.text}>Overview</Text>
      <Text style={styles.text}>{data.overview}</Text>
      <Text></Text>
      <Text style={styles.text}>Budget: ${data.budget}</Text>
      <Text style={styles.text}>Revenue: ${data.revenue}</Text>
      <Text></Text>
      <Text style={styles.text}>Release Date: {data.release_date}</Text>
      <Text></Text>
      <Text style={styles.text}>Run time: {data.runtime} mins</Text>
      <Text></Text>
      <Text style={styles.text}>Genre(s): {genres}</Text>
      <Text></Text>
      <Text style={styles.text}>Original Language: {data.original_language}</Text>
      <Text style={styles.text}>Spoken Language(s): {spokenLangs}</Text>
      <Text></Text>
      <Text style={styles.text}>Vote Average: {data.vote_average}</Text>
      <Text style={styles.text}>Vote Count: {data.vote_count}</Text>
      <Text></Text>
      <Text style={styles.text}>Production Companies:</Text>
      <FlatList
        style={styles.comp_container}
        numColumns={3}
        keyExtractor={(item,index)=>index.toString()}
        data={data.production_companies}
        renderItem={({item})=>(
          <Pressable onPress={() => showImageModal(item.logo_path)}>
            <View  style={styles.complogoContainer}>
              <Text style={styles.comp_text}>{item.name} </Text>
            </View>
          </Pressable>
          
        )}
      />
      <Text></Text>
      <Text style={styles.text_white}>Related Movies:</Text>
      <Text></Text>
      <FlatList
          numColumns={2}
          keyExtractor={(item,index)=>index.toString()}
          data={relatedmoviesList}
          renderItem={({item})=>(
            <View style={styles.movieContainer}>
              <Pressable onPress={()=>displayDetails(item.id)}>
                <Image
                  style={styles.image_home}
                  source={{uri:'https://image.tmdb.org/t/p/w500' + item.poster_path}}
                  resizeMode='stretch'
                />
              </Pressable>
            </View>
          )}
        />
    </ScrollView>
  )
}
//#endregion

//#region App Function
function App(){
  return(
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen style={styles.hide}
          name='Home'
          component={Home}
        />
        <Stack.Screen
          name='Details'
          component={Details}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
//#endregion

//#region Styles
const styles = StyleSheet.create({
  hide:{
    display:'none'
  },
  body: {
    flex: 1,
    backgroundColor: '#011627',
    color: '#ffffff'
  },
  details_body: {
    flex: 1,
    backgroundColor: '#011627',
    color: '#ffffff',
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft:10,
    marginRight:10,
  },
  center_text_heading:{
    color: '#ffffff',
    fontSize: 14,
    marginLeft:10,
    marginRight:10,
    textAlign:'center',
    fontSize:20,
    fontWeight:'bold',
  },
  text_white:{
    color: 'white',
    fontSize: 14,
    margin: 10,
  },
  recentText:{
    color: '#ffffff',
    fontSize: 14,
  },
  removerecent:{
    color:"red",
    fontSize: 14,
  },
  text_header:{
    color: '#ffffff',
    fontSize: 20,
    margin: 10,
  },
  input: {
    width: 250,
    height:40,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 5,
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 10,
    color:'#ffffff',
  },
  button: {
    width: 100,
    height: 40,
    alignItems: 'center',
    borderRadius:5,
  },
  recentBox:{
    backgroundColor:"#40015D",
    margin:5,
    borderRadius:5,
    paddingTop:0,
    paddingBottom:3,
    padding:7,
    flexDirection:'row',
  },
  xbutton:{
    padding:0,
    margin:0,
    
  },
  movieContainer:{
    width:"50%",
    marginBottom:15,
    color: '#ffffff',
    alignItems:'center'

  },
  complogoContainer:{
    padding:5,
    margin:5,
    backgroundColor:'#ffffff',
  },
  history_box:{
    textAlign: 'center',
    marginTop: 5,
  },
  image:{
    width: 200,
    height: 300,
    margin: 10,
  },
  image_home:{
    width: 140,
    height: 200,
    // margin: 10,
  },
  center:{
    alignItems:'center',
  },
  center_title:{
    alignItems:'center',
    width:'90%'
  },
  details_top:{
    flexDirection:'row',
    width:'90%'
  },
  back_arrow:{
    color:'white',
    margin:8
  },
  comp_text:{
    color:'#000000',
    fontSize: 10
  },
  comp_container:{
    marginLeft:8
  },
  centered_view: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000099'
  },
  image_modal: {
    width: 300,
    height: 300,
    backgroundColor: '#ffffff',
  },
  modal_body: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal_image:{
    width: 290,
    height: 270,
  },
  close_button:{
    height:20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor:'#011627',
  },
  main_loading:{
    position: 'absolute',
    left: 0,
    right: 0,
    // top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex:2
  },
  loading_view:{
    alignItems:'center',
  },
});
//#endregion

//#region Create Table
const createTable = () => {
  db.transaction((tx) => {
      tx.executeSql(
          "CREATE TABLE IF NOT EXISTS "
          + "tbl_searches"
          + "(ID INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, date datetime );"
      )
  })
}
//#endregion

export default App;