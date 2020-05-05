const baseStats = require('./masterfile.json');
const cpMultiplier = require('./cp_multiplier.json');
const mysql = require('mysql');

let pokemon = {};
let pokemonObject = baseStats.pokemon;

// ENTER DB CREDENTIALS HERE
let database = {
    "host": "",
    "user": "",
    "password": "",
    "database": ""
};

CalculateAllRanks();

async function CalculateAllRanks()
{
    for(var pokemonID in pokemonObject)
    {
        if(pokemonObject[pokemonID].attack)
        {
            CalculateTopRanks(pokemonID,-1,2500);
        }
    
        for(var formID in pokemonObject[pokemonID].forms)
        {
            if(pokemonObject[pokemonID].forms[formID].attack)
            {
                CalculateTopRanks(pokemonID, formID, 2500);
            }
        }
    }  

    console.log("About to write ultra_league pvp data to SQL table");

    await WritePvPData(pokemon, "ultra_league");
    
    console.log("Done writing ultra_league data to SQL");

    for(var pokemonID in pokemonObject)
    {
        if(pokemonObject[pokemonID].attack)
        {
            CalculateTopRanks(pokemonID,-1,1500);
        }
        for(var formID in pokemonObject[pokemonID].forms)
        {
            if(pokemonObject[pokemonID].forms[formID].attack)
            {
                CalculateTopRanks(pokemonID, formID, 1500);
            }
        }
        
    }

   console.log("About to write great_league pvp data to SQL table");

    await WritePvPData(pokemon, "great_league");

    console.log("All data written");


}



function CalculateTopRanks(pokemonID, formID, cap)
{
    console.log("Calculating Top Ranks for: "+baseStats.pokemon[pokemonID].name+" which is number: "+pokemonID+" and Form ID: "+formID);
    
    let currentPokemon = InitializeBlankPokemon();
    let bestStat = {attack: 0, defense: 0, stamina: 0, value: 0};
    let arrayToSort = [];
    
    if(!pokemon[pokemonID])
    {
        pokemon[pokemonID] = {};
    }
   
    for(a = 0; a <= 15; a++)
    {
        for(d = 0; d <= 15; d++)
        {
            for(s = 0; s <= 15; s++)
            {
                let currentStat = CalculateBestPvPStat(pokemonID,formID, a,d,s, cap);

                if(currentStat > bestStat.value)
                {
                    bestStat = {attack: a, defense: d, stamina: s, value: currentStat.value, level: currentStat.level};
                }

                currentPokemon[a][d][s] = {value: currentStat.value, level: currentStat.level, CP: currentStat.CP }                

                arrayToSort.push({attack:a, defense:d, stamina:s, value:currentStat.value});
                
            }
        }
    }

    arrayToSort.sort(function(a,b) {
        return b.value - a.value;
    });

    let best = arrayToSort[0].value;
    
    for(var i = 0; i < arrayToSort.length; i++)
    {
        let percent = PrecisionRound((arrayToSort[i].value / best) * 100, 2);
        arrayToSort[i].percent = percent;
        currentPokemon[arrayToSort[i].attack][arrayToSort[i].defense][arrayToSort[i].stamina].percent = percent;
        currentPokemon[arrayToSort[i].attack][arrayToSort[i].defense][arrayToSort[i].stamina].rank = i+1;        
    }
    
    if(formID >= 0)
    {
        if(!pokemon[pokemonID].forms)
        {
            pokemon[pokemonID].forms = {};
        }
        pokemon[pokemonID].forms[formID] = currentPokemon;
    }
    else
    {
        pokemon[pokemonID] = currentPokemon;  
    }
    
    return currentPokemon;
}

function CalculateBestPvPStat(pokemonID, formID, attack, defense, stamina, cap)
{
    let bestStat = 0;
    let level = 0;
    let bestCP = 0;
    for(var i = 1; i <= 40; i += .5)
    {
        let CP = CalculateCP(pokemonID,formID,attack, defense, stamina, i);
        if(CP <= cap)
        {
            let stat = CalculatePvPStat(pokemonID, formID, i, attack, defense, stamina);
            if(stat > bestStat)
            {
                bestStat = stat;
                level = i;   
                bestCP = CP;
            }
        }
    }

    return {value: bestStat, level: level, CP: bestCP};
}

function CalculatePvPStat(pokemonID, formID, level, attack, defense, stamina)
{
    

    let pokemonAttack = (formID >= 0 && pokemonObject[pokemonID].forms[formID].attack) ? pokemonObject[pokemonID].forms[formID].attack : pokemonObject[pokemonID].attack;
	let pokemonDefense = (formID >= 0 && pokemonObject[pokemonID].forms[formID].defense) ? pokemonObject[pokemonID].forms[formID].defense : pokemonObject[pokemonID].defense;
	let pokemonStamina = (formID >= 0 && pokemonObject[pokemonID].forms[formID].stamina) ? pokemonObject[pokemonID].forms[formID].stamina : pokemonObject[pokemonID].stamina;

    attack = (attack + pokemonAttack) * cpMultiplier[level];
    defense = (defense + pokemonDefense) * cpMultiplier[level];
    stamina = (stamina + pokemonStamina) * cpMultiplier[level];

    product = attack * defense * Math.floor(stamina);

    product = Math.round(product);

    return product;
}

function CalculateCP(pokemonID, formID, attack , defense, stamina, level)
{
	let CP = 0;
	
	let CPMultiplier = cpMultiplier[level];
  
	let pokemonAttack = (formID >= 0 && pokemonObject[pokemonID].forms[formID].attack) ? pokemonObject[pokemonID].forms[formID].attack : pokemonObject[pokemonID].attack;
	let pokemonDefense = (formID >= 0 && pokemonObject[pokemonID].forms[formID].defense) ? pokemonObject[pokemonID].forms[formID].defense : pokemonObject[pokemonID].defense;
	let pokemonStamina = (formID >= 0 && pokemonObject[pokemonID].forms[formID].stamina) ? pokemonObject[pokemonID].forms[formID].stamina : pokemonObject[pokemonID].stamina;

	let attackMultiplier = pokemonAttack + parseInt(attack);
	let defenseMultiplier = Math.pow(pokemonDefense + parseInt(defense),.5);
	let staminaMultiplier = Math.pow(pokemonStamina + parseInt(stamina),.5);
	CPMultiplier = Math.pow(CPMultiplier,2);

	CP = (attackMultiplier * defenseMultiplier * staminaMultiplier * CPMultiplier) / 10;

	CP = Math.floor(CP);

	//CP floor is 10
	if(CP < 10)  {CP = 10}
	

	return CP;
}

function InitializeBlankPokemon()
{
    let newPokemon = {};

    for(var a = 0; a <= 15; a++)
    {
        newPokemon[a] = {};

        for(var d = 0; d <= 15; d++)
        {
            newPokemon[a][d] = {};

            for(var s = 0; s <= 15; s++)
            {
                newPokemon[a][d][s] = {};
            }
        }
    }

    return newPokemon;

}

function PrecisionRound(number, precision) 
{
	var factor = Math.pow(10, precision);
	return Math.round(number * factor) / factor;
}

async function WritePvPData(data, tableName)
{
    return await new Promise(async function(resolve) {

        let connection = mysql.createConnection(database);

        connection.connect(async function(error) {
            if(error)
            {
                console.log("Error connecting to SQL: "+error.stack);
                    connection.end(function(err) {
                        
                    });
                return resolve(false);

            }

            await CreateTable(connection, tableName);

            for(let pokemon in data)
            {
                if(data[pokemon].forms)
                {
                    for(let form in data[pokemon].forms)
                    {
                        console.log("Inserting pokemonID: "+pokemon+" and formID: "+form);
                        let currentPokemon = data[pokemon].forms[form];
                        await InsertCurrentPokemon(connection, tableName, parseInt(pokemon), parseInt(form), currentPokemon);
                    }
                }
                else
                {
                    console.log("Inserting pokemonID: "+pokemon+ " which has no form");
                    let currentPokemon = data[pokemon];
                    await InsertCurrentPokemon(connection, tableName, parseInt(pokemon), 0, currentPokemon);
                }
            }

            connection.end(function(err) {
                return resolve(true);
            });
            

        });
        
    });
}

async function CreateTable(connection, tableName)
{
    return await new Promise(async function(resolve) {
        let sqlQuery = "CREATE TABLE IF NOT EXISTS `"+tableName+"` ( `pokemon_id` smallint(6) unsigned NOT NULL, `form` smallint(6) unsigned DEFAULT 0, `attack` tinyint(2) unsigned DEFAULT 0, `defense` tinyint(2) unsigned DEFAULT 0, `stamina` tinyint(2) unsigned DEFAULT 0, `CP` smallint(4) UNSIGNED DEFAULT 0, `level` DOUBLE(3,1) UNSIGNED DEFAULT 0, `rank` smallint(4) UNSIGNED DEFAULT 0, `percent` DOUBLE(5, 2) UNSIGNED DEFAULT 0, `value` mediumint(8) UNSIGNED DEFAULT 0, PRIMARY KEY(pokemon_id, form, attack, defense, stamina))";

        let pause = sqlQuery;

        connection.query(sqlQuery, function(error,results) {
            if(error) { throw error; }

            console.log("Table created if needed: "+tableName);

            connection.query("TRUNCATE "+tableName+";", async function(error, results) {
                if(error) { throw error; }
                console.log("Table truncated: "+tableName);
                return resolve(true);
            });
        });

        
    });
}

async function InsertCurrentPokemon(connection, tableName, pokemonID, formID, pokemon)
{
    return await new Promise(async function(resolve) {
        let sqlStatement = 'INSERT INTO `'+tableName+'` (`pokemon_id`, `form`, `attack`, `defense`, `stamina`, `CP`, `level`, `percent`, `rank`, `value`) VALUES';
        for(let attack in pokemon)
        {
            for(let defense in pokemon[attack])
            {
                for(let stamina in pokemon[attack][defense])
                {
                    let currentValue = pokemon[attack][defense][stamina];
                    sqlStatement = sqlStatement + '('+pokemonID+','+formID+','+parseInt(attack)+','+parseInt(defense)+','+parseInt(stamina)+','+currentValue.CP+','+currentValue.level+','+currentValue.percent+','+currentValue.rank+','+currentValue.value+'),'
                    
                }
            }
        }

        sqlStatement = sqlStatement.slice(0,-1);
        sqlStatement = sqlStatement + ';';

        connection.query(sqlStatement, async function(error, results) {
            if(error) { throw error; }
            return resolve(true);
        })
        
    });
}