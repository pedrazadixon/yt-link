<?php

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

var_dump($_SERVER);
exit();

// http://150.136.155.157:8090/px?url=

include_once 'foreign_chars.php';

if (!isset($_GET['q']))
    exit(json_encode(['error' => 'no url']));

$q = urldecode($_GET['q']);

if (preg_match('/^https?:\/\/.*deezer.com\//', $q)) {
    $url_splited = explode('/track/', $q);

    if (!isset($url_splited[1]) || empty($url_splited[1]))
        exit(json_encode(['error' => 'invalid deezer track id']));

    $raw = file_get_contents('https://api.deezer.com/track/' . $url_splited[1]);
    $dee_track_info = json_decode($raw, true);

    if (isset($dee_track_info["error"]))
        exit(json_encode(['error' => 'can\'t get track info for this id. Deezer error: ' . $dee_track_info["error"]["message"]]));

    $array_from = array_keys($foreign_characters);
    $array_to = array_values($foreign_characters);
    $str =  preg_replace($array_from, $array_to, $dee_track_info["title"] . ' - ' . $dee_track_info["artist"]["name"]);

    $cmd = 'youtube-dl -f bestaudio --geo-bypass --get-url "ytsearch1:' . $str . ' music" ';
    exeCommand($cmd);
}

if (preg_match('/^https?:\/\//', $q)) {
    $cmd = 'youtube-dl -f bestaudio --geo-bypass --get-url "' . $q . '" ';
    exeCommand($cmd);
}

$array_from = array_keys($foreign_characters);
$array_to = array_values($foreign_characters);
$q =  preg_replace($array_from, $array_to, $q);

$cmd = 'youtube-dl -f bestaudio --geo-bypass --get-url "ytsearch1:' . $q . ' music" ';
exeCommand($cmd);

function exeCommand($cmd)
{
    $shell = trim(shell_exec($cmd));
    if (empty($shell))
        exit(json_encode(['error' => 'can\'t get audio from url']));
    exit(json_encode(['success' => $shell]));
}
