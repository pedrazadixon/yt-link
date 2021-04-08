<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>yt-link</title>
  <script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js"></script>
</head>

<body>

  <style>
    audio,
    input,
    button,
    span {
      min-width: 350px;
      max-width: 350px;
      padding: 0px;
      display: block;
    }
  </style>

  <br />
  <input id="input-q" type="text" placeholder="https://youtu.be/lnAb9dnQCFE" />
  <br />
  <button id="get-audio">Play!</button>
  <br />
  <audio id="audio-player" src="" controls controlsList="nodownload"></audio>
  <br />
  <span id="status-text"></span>

</body>

<script>
  document.addEventListener("DOMContentLoaded", function() {
    $("#get-audio").click(function(params) {
      var q = $("#input-q").val().trim();
      q = q.replace("\"", "");

      if (q != "") {

        $("#get-audio").prop("disabled", true);
        $("#status-text").text("getting audio...");

        var ajaxUrl =
          "api.php?q=" + encodeURIComponent(q);

        console.log("sending request to ", ajaxUrl);

        $.ajax({
          url: ajaxUrl,
          dataType: "json",
          crossDomain: true,
          success: function(result) {
            if (result.success) {
              console.log("sucess", result);

              setTimeout(() => {
                $("#status-text").text("success");
              }, 500);

              var audio = document.getElementById("audio-player");
              audio.setAttribute("src", result.success);
              audio.load();
              audio.play();
            } else {
              console.log("error", result);
              $("#status-text").text(result.error);
            }
          },
          error: function(err) {
            console.log("error", err);
            $("#status-text").text("error!");
          },
          complete: function() {
            console.log("complete");

            setTimeout(() => {
              $("#get-audio").prop("disabled", false);
            }, 500);

          },
        });
      }
    });
  });
</script>

</html>